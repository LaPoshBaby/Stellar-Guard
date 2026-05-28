import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NetworkBadge } from "../components/NetworkBadge";
import { getNetworkDetails } from "@stellar/freighter-api";

const mockGetNetworkDetails = getNetworkDetails as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test("renders TESTNET badge when Freighter is on testnet", async () => {
  mockGetNetworkDetails.mockResolvedValue({
    network: "TESTNET",
    networkUrl: "",
    networkPassphrase: "",
    sorobanRpcUrl: "",
  });
  render(<NetworkBadge />);
  await waitFor(() =>
    expect(screen.getByTestId("network-badge")).toHaveTextContent("TESTNET")
  );
  expect(screen.queryByTestId("network-mismatch-warning")).not.toBeInTheDocument();
});

test("renders MAINNET badge when Freighter is on mainnet", async () => {
  mockGetNetworkDetails.mockResolvedValue({
    network: "PUBLIC",
    networkUrl: "",
    networkPassphrase: "",
    sorobanRpcUrl: "",
  });
  render(<NetworkBadge />);
  await waitFor(() =>
    expect(screen.getByTestId("network-badge")).toHaveTextContent("MAINNET")
  );
});

test("shows mismatch warning when Freighter is on mainnet but app expects testnet", async () => {
  mockGetNetworkDetails.mockResolvedValue({
    network: "PUBLIC",
    networkUrl: "",
    networkPassphrase: "",
    sorobanRpcUrl: "",
  });
  render(<NetworkBadge />);
  await waitFor(() =>
    expect(screen.getByTestId("network-mismatch-warning")).toBeInTheDocument()
  );
});

test("renders nothing when getNetworkDetails throws", async () => {
  mockGetNetworkDetails.mockRejectedValue(new Error("Freighter not installed"));
  const { container } = render(<NetworkBadge />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
