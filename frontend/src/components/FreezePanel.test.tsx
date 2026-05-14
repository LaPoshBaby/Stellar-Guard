import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FreezePanel } from "../components/FreezePanel";

jest.mock("@stellar/freighter-api", () => ({
  signTransaction: jest.fn(),
}));

jest.mock("axios", () => ({
  post: jest.fn(),
}));

import { signTransaction } from "@stellar/freighter-api";
import axios from "axios";

const mockSign = signTransaction as jest.Mock;
const mockPost = axios.post as jest.Mock;

const VALID_KEY = "GCX6QWASDB2FFJKP4ZQXM4Q3UJLNSW5LJTUWA6CD5WTATUE6WWB5GJCH";

beforeEach(() => jest.clearAllMocks());

test("shows Vote to Freeze button when wallet connected", () => {
  render(<FreezePanel adminKey={VALID_KEY} onError={jest.fn()} />);
  expect(screen.getByText("Vote to Freeze")).toBeInTheDocument();
});

test("button is disabled when wallet not connected", () => {
  render(<FreezePanel adminKey={null} onError={jest.fn()} />);
  expect(screen.getByText("Vote to Freeze")).toBeDisabled();
});

test("calls onError on invalid asset code", async () => {
  const onError = jest.fn();
  render(<FreezePanel adminKey={VALID_KEY} onError={onError} />);
  fireEvent.change(screen.getByPlaceholderText(/Asset Code/i), { target: { value: "bad asset!" } });
  fireEvent.click(screen.getByText("Vote to Freeze"));
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining("Asset code")));
});

test("shows success after successful vote", async () => {
  mockPost
    .mockResolvedValueOnce({ data: { xdr: "unsigned_xdr" } })
    .mockResolvedValueOnce({ data: { votes: 2 } });
  mockSign.mockResolvedValue("signed_xdr");

  render(<FreezePanel adminKey={VALID_KEY} onError={jest.fn()} />);
  fireEvent.change(screen.getByPlaceholderText(/Asset Code/i), { target: { value: "RWAUSD" } });
  fireEvent.change(screen.getByPlaceholderText(/Issuer/i), { target: { value: VALID_KEY } });
  fireEvent.change(screen.getByPlaceholderText(/Target/i), { target: { value: VALID_KEY } });
  fireEvent.click(screen.getByText("Vote to Freeze"));

  await waitFor(() => expect(screen.getByText(/Vote submitted/)).toBeInTheDocument());
});

test("calls onError on network failure", async () => {
  const onError = jest.fn();
  mockPost.mockRejectedValue({ message: "ECONNREFUSED" });

  render(<FreezePanel adminKey={VALID_KEY} onError={onError} />);
  fireEvent.change(screen.getByPlaceholderText(/Asset Code/i), { target: { value: "RWAUSD" } });
  fireEvent.change(screen.getByPlaceholderText(/Issuer/i), { target: { value: VALID_KEY } });
  fireEvent.change(screen.getByPlaceholderText(/Target/i), { target: { value: VALID_KEY } });
  fireEvent.click(screen.getByText("Vote to Freeze"));

  await waitFor(() => expect(onError).toHaveBeenCalled());
});
