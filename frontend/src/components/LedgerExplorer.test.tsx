import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { LedgerExplorer } from "../components/LedgerExplorer";

jest.mock("axios");
// recharts uses ResizeObserver which isn't in jsdom
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

import axios from "axios";
const mockGet = axios.get as jest.Mock;

const ADDR_A = "GCX6QWASDB2FFJKP4ZQXM4Q3UJLNSW5LJTUWA6CD5WTATUE6WWB5GJCH";
const ADDR_B = "GBVZDJKFKBKRHALTAQTJZUT4JXNXATGGVGFLIF5MHXKJFNYWHHQWYFQ2";

const TRANSFERS = [
  { id: "1", from: ADDR_A, to: ADDR_B, amount: 500, asset: "XLM", ts: "2026-05-14T12:00:00Z" },
  { id: "2", from: ADDR_A, to: ADDR_B, amount: 50_000_000, asset: "XLM", ts: "2026-05-14T12:01:00Z" },
];

beforeEach(() => jest.clearAllMocks());

test("renders loading state initially", () => {
  mockGet.mockReturnValue(new Promise(() => {})); // never resolves
  render(<LedgerExplorer onSuspicious={jest.fn()} />);
  expect(screen.getByText("Loading…")).toBeInTheDocument();
});

test("renders transfer rows after fetch", async () => {
  mockGet.mockResolvedValue({ data: TRANSFERS });
  render(<LedgerExplorer onSuspicious={jest.fn()} />);
  await waitFor(() => expect(screen.getAllByText("XLM")).toHaveLength(2));
});

test("calls onSuspicious for high-volume transfer", async () => {
  const onSuspicious = jest.fn();
  mockGet.mockResolvedValue({ data: TRANSFERS });
  render(<LedgerExplorer onSuspicious={onSuspicious} />);
  await waitFor(() => expect(onSuspicious).toHaveBeenCalledWith(
    expect.stringContaining("high-volume")
  ));
});

test("does not call onSuspicious for normal transfer", async () => {
  const onSuspicious = jest.fn();
  mockGet.mockResolvedValue({ data: [TRANSFERS[0]] }); // only the 500 XLM one
  render(<LedgerExplorer onSuspicious={onSuspicious} />);
  await waitFor(() => expect(screen.getAllByText("XLM")).toHaveLength(1));
  expect(onSuspicious).not.toHaveBeenCalled();
});

test("handles fetch error silently", async () => {
  mockGet.mockRejectedValue(new Error("Network error"));
  render(<LedgerExplorer onSuspicious={jest.fn()} />);
  // Should not throw; loading disappears after failed fetch
  await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
});
