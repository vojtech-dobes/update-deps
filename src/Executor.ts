import * as core from '@actions/core';
import * as exec from '@actions/exec';

export class Executor {

	readonly cwd: string;
	readonly logPrefix: string;

	constructor(cwd: string, logPrefix: string) {
		this.cwd = cwd;
		this.logPrefix = logPrefix;
	}

	async exec(
		label: string,
		args: ReadonlyArray<string>,
		options: exec.ExecOptions = {},
	): Promise<string> {
		const group = this.logPrefix !== ''
			? `${this.logPrefix}: ${label}`
			: label;

		return await core.group(
			group,
			async () => await runCommand(this.cwd, args, options),
		);
	}

}

async function runCommand(
	cwd: string,
	args: ReadonlyArray<string>,
	options: exec.ExecOptions,
): Promise<string> {
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
		...options,
	});

	return myOutput === '' ? myError : myOutput;
}
