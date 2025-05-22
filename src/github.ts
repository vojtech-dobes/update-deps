import * as fs from 'fs';
import type * as github from '@actions/github';
import * as path from 'path';
import * as url from 'url';

type Octokit = ReturnType<typeof github.getOctokit>;

function getQueryFromFile(name: string): string {
	const __filename = url.fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);

	return fs.readFileSync(`${__dirname}/../graphql/${name}.gql`, 'utf8');
}

export async function createBranch(octokit: Octokit, params: {
	branchName: string,
	oid: string,
	repositoryId: string,
}) {
	await octokit.graphql(getQueryFromFile('createRef'), {
		name: `refs/heads/${params.branchName}`,
		oid: params.oid,
		repositoryId: params.repositoryId,
	});
}

export async function createCommitOnBranch(octokit: Octokit, params: {
	branchName: string,
	commitBody: string | null,
	commitHeadline: string,
	expectedHeadOid: string,
	fileChanges: {
		additions?: Array<{
			contents: string,
			path: string,
		}>,
	}
	repositoryName: string,
	repositoryOwner: string,
}) {
	const result: any = await octokit.graphql(getQueryFromFile('createCommitOnBranch'), {
		branchName: params.branchName,
		commitBody: params.commitBody,
		commitHeadline: params.commitHeadline,
		expectedHeadOid: params.expectedHeadOid,
		fileChanges: params.fileChanges,
		githubRepository: `${params.repositoryOwner}/${params.repositoryName}`,
	});

	return result.createCommitOnBranch.commit.oid;
}

export async function deleteRef(octokit: Octokit, params: {
	refId: any,
}) {
	await octokit.graphql(getQueryFromFile('deleteRef'), params);
}

export async function getExistingBranch(octokit: Octokit, params: {
	branchName: string,
	repositoryName: string,
	repositoryOwner: string,
}) {
	try {
		const { data } = await octokit.rest.git.getRef({
			owner: params.repositoryOwner,
			repo: params.repositoryName,
			ref: `heads/${params.branchName}`,
		});

		return data;
	} catch (error: any) {
		if (error.status) {
			return null;
		}

		throw error;
	}
}

export async function getRepositoryData(octokit: Octokit, params: {
	repositoryName: string,
	repositoryOwner: string,
}): Promise<{
	defaultBranch: string,
	id: string,
}> {
	const result: any = await octokit.graphql(getQueryFromFile('getRepositoryData'), {
			repositoryName: params.repositoryName,
			repositoryOwner: params.repositoryOwner,
		},
	);

	return {
		defaultBranch: result.repository.defaultBranchRef.name,
		id: result.repository.id,
	};
}

export async function listAlreadyOpenPullRequests(octokit: Octokit, params: {
	baseRefName: string,
	headRefName: string,
	repositoryName: string,
	repositoryOwner: string,
}): Promise<ReadonlyArray<{
	id: string,
	mergeable: 'CONFLICTING'|'MERGEABLE'|'UNKNOWN',
}>> {
	const result: any = await octokit.graphql(getQueryFromFile('listAlreadyOpenPullRequests'), params);

	return result.repository.pullRequests.nodes;
}

export async function openPullRequest(octokit: Octokit, params: {
	baseRefName: string,
	headRefName: string,
	repositoryName: string,
	repositoryOwner: string,
	title: string,
}) {
	await octokit.rest.pulls.create({
		base: params.baseRefName,
		head: params.headRefName,
		owner: params.repositoryOwner,
		repo: params.repositoryName,
		title: params.title,
	});
}

export async function updateRef(octokit: Octokit, params: {
	force: boolean,
	oid: string,
	refId: string,
}) {
	await octokit.graphql(getQueryFromFile('updateRef'), params);
}
