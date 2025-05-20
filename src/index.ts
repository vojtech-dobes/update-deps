import * as core from '@actions/core';
import * as fs from 'fs';
import * as github from '@actions/github';
import * as path from 'path';

import {
	ComposerPackageManager,
} from './ComposerPackageManager.js';

import {
	runCommand,
} from './exec.js';

import {
	createBranch,
	createCommitOnBranch,
	deleteRef,
	getExistingBranch,
	getRepositoryData,
	listAlreadyOpenPullRequests,
	openPullRequest,
	updateRef,
} from './github.js';

function getPackageManagerImplementation(type: string) {
	if (type === 'composer') {
		return new ComposerPackageManager();
	}

	throw new Error(
		`Package manager type '${type}' isn't supported`,
	);
}

try {
	let branchPrefix = core.getInput('branch_prefix', {
		trimWhitespace: true,
	});
	if (branchPrefix === '') {
		branchPrefix = 'update-deps';
	}

	const githubToken = core.getInput('github_token', {
		required: true,
		trimWhitespace: true,
	});

	const packageManagerType = core.getInput('package_manager_type', {
		required: true,
		trimWhitespace: true,
	});

	const packageManagerManifestPath = core.getInput('package_manager_manifest_path', {
		required: true,
		trimWhitespace: true,
	});

	const excludeDeps = core.getMultilineInput('exclude_deps', {
		trimWhitespace: true,
	});

	const includeDeps = core.getMultilineInput('include_deps', {
		trimWhitespace: true,
	});

	const packageManagerManifestPathExists = fs.existsSync(packageManagerManifestPath);

	if (packageManagerManifestPathExists === false) {
		throw new Error(`Package manager manifest not found at ${packageManagerManifestPath}`);
	}

	const packageManagerManifestRelativePath = getRelativeManifestPath(packageManagerManifestPath);

	const octokit = github.getOctokit(githubToken);

	const {
		owner: repositoryOwner,
		repo: repositoryName,
	} = github.context.repo;

	const repositoryData = await getRepositoryData(octokit, { repositoryName, repositoryOwner });

	const baseRefName = repositoryData.defaultBranch;
	const headRefName = `${branchPrefix}${packageManagerManifestRelativePath}`;

	const alreadyOpenPullRequests = await listAlreadyOpenPullRequests(octokit, {
		baseRefName,
		headRefName,
		repositoryName,
		repositoryOwner,
	});

	const alreadyOpenConflictingPullRequests = alreadyOpenPullRequests.filter(
		(pullRequest) => pullRequest.mergeable === 'CONFLICTING',
	);

	if (alreadyOpenConflictingPullRequests.length > 0) {
		const existingBranch = await getExistingBranch(octokit, {
			branchName: headRefName,
			repositoryName,
			repositoryOwner,
		});

		if (existingBranch === null) {
			throw new Error(`Branch for existing conflicting pull request must exist`);
		}

		await updateRef(octokit, {
			force: true,
			oid: process.env.GITHUB_SHA,
			refId: existingBranch.node_id,
		});
	} else if (alreadyOpenPullRequests.length !== 0) {
		finishPrematurely(`Pull request for ${packageManagerManifestRelativePath} is already open`);
	} else {
		const existingBranch = await getExistingBranch(octokit, {
			branchName: headRefName,
			repositoryName,
			repositoryOwner,
		});

		if (existingBranch !== null) {
			await deleteRef(octokit, {
				refId: existingBranch.node_id,
			});
		}

		await createBranch(octokit, {
			branchName: headRefName,
			oid: process.env.GITHUB_SHA,
			repositoryId: repositoryData.id,
		});
	}

	const packageManager = getPackageManagerImplementation(packageManagerType);

	const commands = await packageManager.listCommands({
		excludeDeps,
		includeDeps,
		manifestFile: packageManagerManifestPath,
	});

	let expectedHeadOid = process.env.GITHUB_SHA;

	for (let command of commands) {
		if (command === null) {
			continue;
		}

		await runCommand(command.cwd, command.args);

		const changedFiles = await packageManager.listFiles({
			manifestFile: packageManagerManifestPath,
		});

		expectedHeadOid = await createCommitOnBranch(octokit, {
			branchName: headRefName,
			commitBody: command.detailedDescription ?? null,
			commitHeadline: command.description,
			expectedHeadOid,
			fileChanges: {
				additions: changedFiles.map((file) => ({
					path: path.relative(process.env.GITHUB_WORKSPACE, file),
					contents: fs.readFileSync(file).toString('base64'),
				})),
			},
			repositoryName,
			repositoryOwner,
		});
	}

	await openPullRequest(octokit, {
		baseRefName,
		headRefName,
		repositoryName,
		repositoryOwner,
		title: `Update deps in ${packageManagerManifestRelativePath}`,
	});
} catch (error: any) {
	if (error.message !== 'finishPrematurely') {
		core.setFailed(error.message);
	}
}

function finishPrematurely(warning: string) {
	core.warning(warning);

	throw new Error('finishPrematurely');
}

function getRelativeManifestPath(manifestPath: string): string {
	manifestPath = path.relative(process.env.GITHUB_WORKSPACE, manifestPath);

	if (manifestPath[0] === '/') {
		manifestPath = manifestPath.slice(1);
	}

	return manifestPath;
}
