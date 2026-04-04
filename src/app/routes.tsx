import { createHashRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./components/Home";
import { Generate } from "./components/Generate";
import { Success } from "./components/Success";
import { CreateAccount } from "./components/CreateAccount";

export const router = createHashRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "style", Component: CreateAccount },
      { path: "generate", Component: Generate },
      { path: "success", Component: Success },
    ],
  },
]);
