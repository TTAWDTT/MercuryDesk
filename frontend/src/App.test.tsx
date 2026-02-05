import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders login when not authed", () => {
  localStorage.removeItem("mercurydesk_token");
  render(<App />);
  expect(screen.getByText("MercuryDesk")).toBeInTheDocument();
  expect(screen.getByText("Log In")).toBeInTheDocument();
});
