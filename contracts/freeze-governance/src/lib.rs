//! Stellar-Guard: CAP-0077 Multisig Freeze Governance Contract
//!
//! Admins vote to freeze a (asset_code, issuer, target) tuple.
//! At quorum the contract emits a FREEZE event (CAP-0077 freeze_entry
//! host function will be invoked here once stabilised on testnet).

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Vec,
};

const QUORUM: u32 = 3;
/// Proposal TTL: ~7 days at ~5s/ledger = 120_960 ledgers
const PROPOSAL_TTL: u32 = 120_960;
const ADMINS_KEY: soroban_sdk::Symbol = symbol_short!("ADMINS");

#[contracttype]
#[derive(Clone)]
pub struct FreezeProposal {
    pub asset_code: String,
    pub issuer: Address,
    pub target: Address,
    pub votes: Vec<Address>,
}

#[contract]
pub struct FreezeGovernance;

#[contractimpl]
impl FreezeGovernance {
    /// Initialize with a list of authorized admin addresses. One-time call.
    pub fn init(env: Env, admins: Vec<Address>) {
        if env.storage().instance().has(&ADMINS_KEY) {
            panic!("already initialized");
        }
        env.storage().instance().set(&ADMINS_KEY, &admins);
    }

    /// Cast a vote to freeze `target`'s `asset_code` balance.
    /// Returns the current vote count. Emits FREEZE event at quorum.
    pub fn vote_freeze(
        env: Env,
        caller: Address,
        asset_code: String,
        issuer: Address,
        target: Address,
    ) -> u32 {
        caller.require_auth();

        let admins: Vec<Address> = env.storage().instance().get(&ADMINS_KEY).unwrap();
        if !admins.contains(&caller) {
            panic!("UnauthorizedFreezeAttempt");
        }

        let proposal_key = (asset_code.clone(), target.clone());

        let mut proposal: FreezeProposal = env
            .storage()
            .temporary()
            .get(&proposal_key)
            .unwrap_or(FreezeProposal {
                asset_code: asset_code.clone(),
                issuer: issuer.clone(),
                target: target.clone(),
                votes: Vec::new(&env),
            });

        if proposal.votes.contains(&caller) {
            panic!("already voted");
        }

        proposal.votes.push_back(caller);
        let vote_count = proposal.votes.len();

        if vote_count >= QUORUM {
            // CAP-0077: emit FREEZE event. When freeze_entry host function
            // is stabilised on testnet, replace this with the host call.
            env.events().publish(
                (symbol_short!("FREEZE"), asset_code, issuer, target),
                vote_count,
            );
            env.storage().temporary().remove(&proposal_key);
        } else {
            // Extend TTL on every vote so the proposal stays alive
            env.storage()
                .temporary()
                .set(&proposal_key, &proposal);
            env.storage()
                .temporary()
                .extend_ttl(&proposal_key, PROPOSAL_TTL, PROPOSAL_TTL);
        }

        vote_count
    }

    /// Revoke a previously cast vote.
    pub fn revoke_vote(
        env: Env,
        caller: Address,
        asset_code: String,
        target: Address,
    ) {
        caller.require_auth();

        let proposal_key = (asset_code, target);
        let mut proposal: FreezeProposal = env
            .storage()
            .temporary()
            .get(&proposal_key)
            .expect("no proposal found");

        let idx = proposal
            .votes
            .iter()
            .position(|v| v == caller)
            .expect("caller has not voted");

        proposal.votes.remove(idx as u32);
        env.storage().temporary().set(&proposal_key, &proposal);
    }

    /// Return current vote count for a proposal (0 if none or expired).
    pub fn get_votes(env: Env, asset_code: String, target: Address) -> u32 {
        let key = (asset_code, target);
        let proposal: Option<FreezeProposal> = env.storage().temporary().get(&key);
        proposal.map(|p| p.votes.len()).unwrap_or(0)
    }

    /// Add a new admin. Requires caller to be an existing admin.
    pub fn add_admin(env: Env, caller: Address, new_admin: Address) {
        caller.require_auth();
        let mut admins: Vec<Address> = env.storage().instance().get(&ADMINS_KEY).unwrap();
        if !admins.contains(&caller) {
            panic!("UnauthorizedFreezeAttempt");
        }
        if !admins.contains(&new_admin) {
            admins.push_back(new_admin);
            env.storage().instance().set(&ADMINS_KEY, &admins);
        }
    }

    /// Remove an admin. Requires caller to be an existing admin.
    /// Cannot remove the last admin.
    pub fn remove_admin(env: Env, caller: Address, admin_to_remove: Address) {
        caller.require_auth();
        let mut admins: Vec<Address> = env.storage().instance().get(&ADMINS_KEY).unwrap();
        if !admins.contains(&caller) {
            panic!("UnauthorizedFreezeAttempt");
        }
        if admins.len() <= 1 {
            panic!("cannot remove last admin");
        }
        let idx = admins
            .iter()
            .position(|a| a == admin_to_remove)
            .expect("admin not found");
        admins.remove(idx as u32);
        env.storage().instance().set(&ADMINS_KEY, &admins);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    fn asset(env: &Env) -> String {
        String::from_str(env, "RWAUSD")
    }

    #[test]
    fn test_vote_and_quorum() {
        let env = Env::default();
        let cid = env.register_contract(None, FreezeGovernance);
        let client = FreezeGovernanceClient::new(&env, &cid);

        let (a1, a2, a3) = (
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        );
        let issuer = Address::generate(&env);
        let target = Address::generate(&env);

        client.init(&Vec::from_array(&env, [a1.clone(), a2.clone(), a3.clone()]));
        env.mock_all_auths();

        assert_eq!(client.vote_freeze(&a1, &asset(&env), &issuer, &target), 1);
        assert_eq!(client.vote_freeze(&a2, &asset(&env), &issuer, &target), 2);
        // Third vote reaches quorum — proposal is removed after event
        assert_eq!(client.vote_freeze(&a3, &asset(&env), &issuer, &target), 3);
        // After quorum the proposal is gone
        assert_eq!(client.get_votes(&asset(&env), &target), 0);
    }

    #[test]
    fn test_revoke_vote() {
        let env = Env::default();
        let cid = env.register_contract(None, FreezeGovernance);
        let client = FreezeGovernanceClient::new(&env, &cid);

        let (a1, a2, a3) = (
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        );
        let issuer = Address::generate(&env);
        let target = Address::generate(&env);

        client.init(&Vec::from_array(&env, [a1.clone(), a2.clone(), a3.clone()]));
        env.mock_all_auths();

        client.vote_freeze(&a1, &asset(&env), &issuer, &target);
        client.vote_freeze(&a2, &asset(&env), &issuer, &target);
        assert_eq!(client.get_votes(&asset(&env), &target), 2);

        client.revoke_vote(&a1, &asset(&env), &target);
        assert_eq!(client.get_votes(&asset(&env), &target), 1);
    }

    #[test]
    fn test_add_remove_admin() {
        let env = Env::default();
        let cid = env.register_contract(None, FreezeGovernance);
        let client = FreezeGovernanceClient::new(&env, &cid);

        let a1 = Address::generate(&env);
        let a2 = Address::generate(&env);
        client.init(&Vec::from_array(&env, [a1.clone()]));
        env.mock_all_auths();

        client.add_admin(&a1, &a2);
        client.remove_admin(&a1, &a2);
    }

    #[test]
    #[should_panic(expected = "UnauthorizedFreezeAttempt")]
    fn test_unauthorized_vote() {
        let env = Env::default();
        let cid = env.register_contract(None, FreezeGovernance);
        let client = FreezeGovernanceClient::new(&env, &cid);

        let a1 = Address::generate(&env);
        let stranger = Address::generate(&env);
        let issuer = Address::generate(&env);
        let target = Address::generate(&env);

        client.init(&Vec::from_array(&env, [a1.clone()]));
        env.mock_all_auths();
        client.vote_freeze(&stranger, &asset(&env), &issuer, &target);
    }

    #[test]
    fn test_get_votes_empty() {
        let env = Env::default();
        let cid = env.register_contract(None, FreezeGovernance);
        let client = FreezeGovernanceClient::new(&env, &cid);
        client.init(&Vec::new(&env));
        let target = Address::generate(&env);
        assert_eq!(client.get_votes(&asset(&env), &target), 0);
    }
}
