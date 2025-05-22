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

export async function loadInitialData(octokit: Octokit, params: {
	branchName: string,
	repositoryName: string,
	repositoryOwner: string,
}) {
	const result: any = await octokit.graphql(getQueryFromFile('loadInitialData'), {
		qualifiedName: `refs/heads/${params.branchName}`,
		repositoryName: params.repositoryName,
		repositoryOwner: params.repositoryOwner,
	});

	let existingBranch: {
		id: string,
		pullRequests: ReadonlyArray<{
			id: string,
			mergeable: 'CONFLICTING'|'MERGEABLE'|'UNKNOWN',
		}>,
	} | null =  null;

	if (result.repository.ref !== null) {
		existingBranch = {
			id: result.repository.ref.id,
			pullRequests: result.repository.ref.associatedPullRequests.nodes,
		};
	}

	return {
		defaultBranch: result.repository.defaultBranchRef.name,
		existingBranch,
		repositoryId: result.repository.id,
	};
}

export async function openPullRequest(octokit: Octokit, params: {
	baseRefName: string,
	headRefName: string,
	repositoryId: string,
	title: string,
}): Promise<number> {
	const result: any = await octokit.graphql(getQueryFromFile('createPullRequest'), {
		baseRefName: params.baseRefName,
		body: null,
		headRefName: params.headRefName,
		repositoryId: params.repositoryId,
		title: params.title,
	});

	return result.createPullRequest.pullRequest.number;
}

export async function updateRef(octokit: Octokit, params: {
	force: boolean,
	oid: string,
	refId: string,
}) {
	await octokit.graphql(getQueryFromFile('updateRef'), params);
}
