// Serialize CodeBuddy SDK query() subprocesses — only one CLI at a time.

let chain: Promise<void> = Promise.resolve();

export function withSdkGate<T>(fn: () => Promise<T>): Promise<T> {
	const run = chain.then(fn);
	chain = run.then(() => undefined, () => undefined);
	return run;
}

export async function drainQuery(q: AsyncIterable<unknown>): Promise<void> {
	const timer = new Promise<void>((r) => setTimeout(r, 5000));
	await Promise.race([
		(async () => { for await (const _ of q) { /* drain */ } })(),
		timer,
	]);
}
