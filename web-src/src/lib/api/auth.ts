import baseApi from "../axios/base";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user?: AuthUser;
};

export type SetupData = {
  username: string;
  password: string;
  displayName?: string;
};

export type LoginData = {
  username: string;
  password: string;
};

export async function setupUser(data: SetupData): Promise<AuthTokens> {
  const response = await baseApi.post<AuthTokens>("/auth/setup", data);
  return response.data.result;
}

export async function login(data: LoginData): Promise<AuthTokens> {
  const response = await baseApi.post<AuthTokens>("/auth/login", data);
  return response.data.result;
}

export async function refreshToken(refreshToken: string): Promise<AuthTokens> {
  const response = await baseApi.post<AuthTokens>("/auth/refresh", {
    refreshToken,
  });
  return response.data.result;
}

export async function getMe(): Promise<AuthUser> {
  const response = await baseApi.get<AuthUser>("/auth/me");
  return response.data.result;
}
