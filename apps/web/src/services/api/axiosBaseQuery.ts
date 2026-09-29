import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosRequestConfig } from "axios";
import { http } from "../http/client";
import { ApiError, toApiError } from "../http/errors";

export interface RequestArgs {
  url: string;
  method?: AxiosRequestConfig["method"];
  /** JSON body. Mutations with no body still send `{}` (the API expects JSON on POST/PUT). */
  body?: unknown;
  params?: AxiosRequestConfig["params"];
  responseType?: AxiosRequestConfig["responseType"];
  timeout?: number;
}

/** RTK Query transport over the shared axios instance. Accepts a bare path
 * for GETs. Errors come back as ApiError (message/status/code), and the
 * request is cancelled when RTK Query aborts it (unmount, re-fetch). */
export const axiosBaseQuery =
  (): BaseQueryFn<string | RequestArgs, unknown, ApiError> =>
  async (args, { signal }) => {
    const req: RequestArgs = typeof args === "string" ? { url: args } : args;
    const method = (req.method ?? "GET").toUpperCase();
    const sendsBody = method === "POST" || method === "PUT";
    try {
      const res = await http.request({
        url: req.url,
        method,
        data: req.body !== undefined && req.body !== null ? req.body : sendsBody ? {} : undefined,
        params: req.params,
        responseType: req.responseType,
        timeout: req.timeout,
        signal,
      });
      // 204 No Content -> undefined, like the previous client.
      return { data: res.status === 204 ? undefined : res.data };
    } catch (err) {
      return { error: toApiError(err) };
    }
  };
