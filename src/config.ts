const env = import.meta.env;

export const config = {
  mock: env.VITE_MOCK === "true" || !env.VITE_WS_URL,
  userPoolId: env.VITE_COGNITO_USER_POOL_ID as string,
  clientId: env.VITE_COGNITO_CLIENT_ID as string,
  wsUrl: env.VITE_WS_URL as string,
  dailyLimit: Number(env.VITE_DAILY_LIMIT ?? 50),
};
