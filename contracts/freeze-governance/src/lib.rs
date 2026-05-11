//! Stellar-Guard: CAP-0077 Multisig Freeze Governance Contract

#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec};

const QUORUM: u32 = 3;
const ADMINS_KEY: Symbol = symbol_short!("ADMINS");

#[contracttype]
#[derive(Clone)]
pub struct FreezeProposal {
    pub asset_code: Symbol,
    pub issuer: Address,
    pub target: Address,
    pub votes: Vec<Address>,
}

#[contract]
pub struct FreezeGovernance;

#[contractimpl]
impl FreezeGovernance {
    pub fn init(env: Env, admins: Vec<Address>) {
        if env.storage().instance().has(&ADMINS_KEY) {
            panic!("already initialized");
        }
        env.storage().instance().set(&ADMINS_KEY, &admins);
    }

    pub fn vote_freeze(
        env: Env,
        caller: Address,
        asset_code: Symbol,
        issuer: Address,
        target: Address,
    ) -> u32 {
        caller.require_auth();

        let admins: Vec<Address> = env.storage().instance().get(&ADMINS_KEY).unwrap();

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

        if !admins.contains(&caller) {
            panic!("UnauthorizedFreezeAttempt");
        }
        if proposal.votes.contains(&caller) {
            panic!("already voted");
        }

        proposal.votes.push_back(caller);
        let vote_count = proposal.votes.len();

        if vote_count >= QUORUM {
            env.events().publish(
                (symbol_short!("FREEZE"), asset_code, issuer, target),
                vote_count,
            );
            env.storage().temporary().remove(&proposal_key);
        } else {
            env.storage().temporary().set(&proposal_key, &proposal);
        }

        vote_count
    }

    pub fn get_votes(env: Env, asset_code: Symbol, target: Address) -> u32 {
        let key = (asset_code, target);
        let proposal: Option<FreezeProposal> = env.storage().temporary().get(&key);
        proposal.map(|p| p.votes.len()).unwrap_or(0)
    }

    pub fn add_admin(env: Env, new_admin: Address) {
        let mut admins: Vec<Address> = env.storage().instance().get(&ADMINS_KEY).unwrap();
        if !admins.contains(&new_admin) {
            admins.push_back(new_admin);
            env.storage().instance().set(&ADMINS_KEY, &admins);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_init_and_vote() {
        let env = Env::default();
        let contract_id = env.register_contract(None, FreezeGovernance);
        let client = FreezeGovernanceClient::new(&env, &contract_id);

        let admin1 = Address::generate(&env);
        let admin2 = Address::generate(&env);
        let admin3 = Address::generate(&env);
        let issuer = Address::generate(&env);
        let target = Address::generate(&env);

        let admins = Vec::from_array(&env, [admin1.clone(), admin2.clone(), admin3.clone()]);
        client.init(&admins);

        let asset = symbol_short!("RWAUSD");

        env.mock_all_auths();
        let v1 = client.vote_freeze(&admin1, &asset, &issuer, &target);
        assert_eq!(v1, 1);
        let v2 = client.vote_freeze(&admin2, &asset, &issuer, &target);
        assert_eq!(v2, 2);
    }

    #[test]
    fn test_get_votes_empty() {
        let env = Env::default();
        let contract_id = env.register_contract(None, FreezeGovernance);
        let client = FreezeGovernanceClient::new(&env, &contract_id);

        client.init(&Vec::new(&env));

        let target = Address::generate(&env);
        assert_eq!(client.get_votes(&symbol_short!("XYZ"), &target), 0);
    }
}
