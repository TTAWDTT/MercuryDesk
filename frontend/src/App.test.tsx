import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders login when not authed", async () => {
  localStorage.removeItem("mercurydesk_token");
  render(<App />);
  expect(await screen.findByText("MercuryDesk")).toBeInTheDocument();
  expect(await screen.findByText("登录")).toBeInTheDocument();
});
