declare namespace NodeJS {
  interface ProcessEnv {
    GITHUB_WORKSPACE: string;
    GITHUB_SHA: string,
  }
}
