let accessToken: string | null = null;

export function setAdminAccessToken(token: string | null) {
  accessToken = token;
}

export function getAdminAccessToken() {
  return accessToken;
}

export function clearAdminAccessToken() {
  accessToken = null;
}
