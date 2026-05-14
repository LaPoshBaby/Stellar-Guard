import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WalletConnect } from "../components/WalletConnect";
import { isConnected, getPublicKey } from "@stellar/freighter-api";

const mockIsConnected = isConnected as jest.Mock;
const mockGetPublicKey = getPublicKey as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test("connects successfully and calls onConnect with public key", async () => {
  mockIsConnected.mockResolvedValue(true);
  mockGetPublicKey.mockResolvedValue("GABCDE1234567890ABCDE1234567890ABCDE1234567890ABCDE1234567890");

  const onConnect = jest.fn();
  render(<WalletConnect onConnect={onConnect} />);
  fireEvent.click(screen.getByText("Connect Freighter"));

  await waitFor(() => expect(onConnect).toHaveBeenCalledWith(
    "GABCDE1234567890ABCDE1234567890ABCDE1234567890ABCDE1234567890"
  ));
});

test("shows error when Freighter is not installed", async () => {
  mockIsConnected.mockResolvedValue(false);

  render(<WalletConnect onConnect={jest.fn()} />);
  fireEvent.click(screen.getByText("Connect Freighter"));

  await waitFor(() =>
    expect(screen.getByText("Freighter not installed")).toBeInTheDocument()
  );
});

test("shows error message on connection failure", async () => {
  mockIsConnected.mockResolvedValue(true);
  mockGetPublicKey.mockRejectedValue(new Error("User rejected"));

  render(<WalletConnect onConnect={jest.fn()} />);
  fireEvent.click(screen.getByText("Connect Freighter"));

  await waitFor(() =>
    expect(screen.getByText("User rejected")).toBeInTheDocument()
  );
});
