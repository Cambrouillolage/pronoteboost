import { createHashRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./components/Home";
import { Generate } from "./components/Generate";
import { Success } from "./components/Success";
import { CreateAccount } from "./components/CreateAccount";
import { EmailSent } from "./components/EmailSent";
import { Login } from "./components/Login";
import { BuyCredits } from "./components/BuyCredits";
import { Dashboard } from "./components/Dashboard";

export const router = createHashRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "generate", Component: Generate },
      { path: "success", Component: Success },
      { path: "create-account", Component: CreateAccount },
      { path: "email-sent", Component: EmailSent },
      { path: "login", Component: Login },
      { path: "buy-credits", Component: BuyCredits },
      { path: "dashboard", Component: Dashboard },
    ],
  },
]);
