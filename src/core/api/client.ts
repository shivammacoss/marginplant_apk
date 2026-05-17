import axios from "axios";
import { env } from "@core/config/env";
import { attachInterceptors } from "./interceptors";

export const api = axios.create({
  baseURL: `${env.API_URL}/api/v1`,
  timeout: 30_000,
});

attachInterceptors(api);

export { onAuthFailure } from "./refresh";
