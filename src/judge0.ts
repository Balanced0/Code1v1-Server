const host = process.env.JUDGE0_HOST || "judge0-ce.p.rapidapi.com";
const baseUrl = `https://${host}`;

type JudgeResult = { token:string; stdout:string; stderr:string; compileOutput:string; message:string; time:string|null; memory:number|null; status:{id:number;description:string} };

const encode = (value:string) => Buffer.from(value).toString("base64");
const decode = (value:string | null | undefined) => value ? Buffer.from(value, "base64").toString("utf8") : "";
const headers = () => {
  if (!process.env.RAPIDAPI_KEY) throw new Error("RAPIDAPI_KEY is not configured on the server.");
  return { "Content-Type":"application/json", "X-RapidAPI-Key":process.env.RAPIDAPI_KEY, "X-RapidAPI-Host":host };
};

export const languageIds: Record<string, number> = { cpp:54, python:71, java:62, javascript:63 };

export async function runJudge0(sourceCode:string, language:string, stdin:string): Promise<JudgeResult> {
  const languageId = languageIds[language];
  if (!languageId) throw new Error("That programming language is not supported.");
  const created = await fetch(`${baseUrl}/submissions?base64_encoded=true&wait=false`, { method:"POST", headers:headers(), body:JSON.stringify({ source_code:encode(sourceCode), stdin:encode(stdin), language_id:languageId }) });
  if (!created.ok) throw new Error(`Judge0 rejected the submission: ${await created.text()}`);
  const { token } = await created.json() as { token:string };
  for (let attempt=0; attempt<30; attempt++) {
    await new Promise(resolve=>setTimeout(resolve, 700));
    const response = await fetch(`${baseUrl}/submissions/${token}?base64_encoded=true`, { headers:headers() });
    if (!response.ok) throw new Error(`Judge0 result lookup failed: ${await response.text()}`);
    const result = await response.json() as Omit<JudgeResult,"stdout"|"stderr"|"compileOutput"|"message"> & {stdout?:string;stderr?:string;compile_output?:string;message?:string};
    if (result.status.id > 2) return { token, stdout:decode(result.stdout), stderr:decode(result.stderr), compileOutput:decode(result.compile_output), message:decode(result.message), time:result.time, memory:result.memory, status:result.status };
  }
  throw new Error("Judge0 timed out while processing this submission.");
}
