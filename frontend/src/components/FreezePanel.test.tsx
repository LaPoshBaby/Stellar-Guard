import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FreezePanel, formatCountdown } from "../components/FreezePanel";

jest.mock("@stellar/freighter-api", () => ({
  signTransaction: jest.fn(),
}));

jest.mock("axios", () => ({
  post: jest.fn(),
  get: jest.fn().mockResolvedValue({ data: [] }),
}));

import { signTransaction } from "@stellar/freighter-api";
import axios from "axios";

const mockSign = signTransaction as jest.Mock;
const mockPost = axios.post as jest.Mock;

const VALID_KEY = "GCX6QWASDB2FFJKP4ZQXM4Q3UJLNSW5LJTUWA6CD5WTATUE6WWB5GJCH";

beforeEach(() => jest.clearAllMocks());

// ── formatCountdown unit tests (issue #33) ──────────────────────────────────

test("formatCountdown: days and hours", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const expiresAt = new Date("2026-01-05T12:00:00Z").toISOString(); // 4d 12h
  expect(formatCountdown(expiresAt, now)).toBe("4d 12h");
});

test("formatCountdown: hours and minutes only", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const expiresAt = new Date("2026-01-01T05:30:00Z").toISOString(); // 5h 30m
  expect(formatCountdown(expiresAt, now)).toBe("5h 30m");
});

test("formatCountdown: minutes only", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const expiresAt = new Date("2026-01-01T00:45:00Z").toISOString(); // 45m
  expect(formatCountdown(expiresAt, now)).toBe("45m");
});

test("formatCountdown: expired", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  const expiresAt = new Date("2026-01-01T00:00:00Z").toISOString();
  expect(formatCountdown(expiresAt, now)).toBe("Expired");
});

// ── FreezePanel component tests ─────────────────────────────────────────────

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

test("shows success and clears form after successful vote", async () => {
  mockPost
    .mockResolvedValueOnce({ data: { xdr: "unsigned_xdr" } })
    .mockResolvedValueOnce({ data: { votes: 2 } });
  mockSign.mockResolvedValue("signed_xdr");

  render(<FreezePanel adminKey={VALID_KEY} onError={jest.fn()} />);
  const assetInput = screen.getByPlaceholderText(/Asset Code/i);
  const issuerInput = screen.getByPlaceholderText(/Issuer/i);
  const targetInput = screen.getByPlaceholderText(/Target/i);

  fireEvent.change(assetInput, { target: { value: "RWAUSD" } });
  fireEvent.change(issuerInput, { target: { value: VALID_KEY } });
  fireEvent.change(targetInput, { target: { value: VALID_KEY } });
  fireEvent.click(screen.getByText("Vote to Freeze"));

  await waitFor(() => expect(screen.getByText(/Vote submitted/)).toBeInTheDocument());
  // issue #17: form fields cleared
  expect(assetInput).toHaveValue("");
  expect(issuerInput).toHaveValue("");
  expect(targetInput).toHaveValue("");
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
