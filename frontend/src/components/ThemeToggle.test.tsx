import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "../components/ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

test("renders sun icon when dark mode is active (default)", () => {
  localStorage.setItem("theme", "dark");
  render(<ThemeToggle />);
  expect(screen.getByRole("button", { name: /toggle theme/i })).toHaveTextContent("☀️");
});

test("renders moon icon when light mode is stored", () => {
  localStorage.setItem("theme", "light");
  render(<ThemeToggle />);
  expect(screen.getByRole("button", { name: /toggle theme/i })).toHaveTextContent("🌙");
});

test("defaults to dark mode when no preference stored", () => {
  render(<ThemeToggle />);
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

test("toggles from dark to light on click", () => {
  localStorage.setItem("theme", "dark");
  document.documentElement.classList.add("dark");
  render(<ThemeToggle />);

  fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(localStorage.getItem("theme")).toBe("light");
  expect(screen.getByRole("button", { name: /toggle theme/i })).toHaveTextContent("🌙");
});

test("toggles from light to dark on click", () => {
  localStorage.setItem("theme", "light");
  render(<ThemeToggle />);

  fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("theme")).toBe("dark");
  expect(screen.getByRole("button", { name: /toggle theme/i })).toHaveTextContent("☀️");
});

test("persists preference to localStorage on toggle", () => {
  render(<ThemeToggle />);
  fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
  expect(localStorage.getItem("theme")).toBe("light");
  fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
  expect(localStorage.getItem("theme")).toBe("dark");
});
