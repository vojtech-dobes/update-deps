import type * as exec from '@actions/exec';

export type Command = {
	args: Array<string>,
	cwd: string,
	description: string,
	detailedDescription?: string | null,
	options?: exec.ExecOptions,
};
