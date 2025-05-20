import * as core from '@actions/core';
import * as exec from '@actions/exec';

export async function runCommandWithJsonOutput(cwd: string, args: Array<string>, options: exec.ExecOptions = {}) {
  return await JSON.parse(
    await runCommandWithOutput(cwd, args, options),
  );
}

export async function runCommandWithOutput(cwd: string, args: Array<string>, options: exec.ExecOptions = {}) {
  let myOutput = '';
  let myError = '';

  await exec.exec(args[0], args.slice(1), {
    cwd,
    listeners: {
      stdout: (data) => {
        myOutput += data.toString();
      },
      stderr: (data) => {
        myError += data.toString();
      },
    },
    silent: core.isDebug() === false,
    ...options,
  });

  return myOutput === '' ? myError : myOutput;
}

export async function runCommand(cwd: string, args: Array<string>, options: exec.ExecOptions = {}) {
  await exec.exec(args[0], args.slice(1), {
    cwd,
    silent: core.isDebug() === false,
    ...options,
  });
}
