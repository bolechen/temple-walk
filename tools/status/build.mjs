import {execFileSync} from 'node:child_process';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const shaPattern=/^[a-f0-9]{40}$/;
export function validateDelivery(d){
 if(d.schema_version!==1||d.scene_id!=='T00'||typeof d.summary!=='string'||!d.summary.trim()||!Array.isArray(d.changes)||!Array.isArray(d.known_issues)||!Array.isArray(d.evidence))throw Error('Invalid T00 delivery record');
 for(const a of ['changes','known_issues','evidence'])if(d[a].some(x=>typeof x!=='string'))throw Error('Delivery lists must contain strings');
 return d;
}
export function compose({sha,delivery,deliveryCommit,review,runs,jobs,now=new Date().toISOString()}){
 if(!shaPattern.test(sha))throw Error('Expected full source SHA');validateDelivery(delivery);
 const exact=runs.filter(r=>r.head_sha===sha).sort((a,b)=>b.id-a.id)[0];
 const deployed=runs.filter(r=>r.status==='completed'&&r.conclusion==='success').sort((a,b)=>b.id-a.id)[0];
 const steps=jobs.flatMap(j=>j.steps||[]);
 const check=name=>{const s=steps.find(s=>s.name===name);return s?.conclusion||s?.status||'pending';};
 const verified=exact&&exact.id===jobs.run_id;
 const currentReview=shaPattern.test(review.reviewed_commit||'')&&review.reviewed_commit===sha;
 // Older reviews remain visible as evidence, never inherited by a new commit.
 const independent={...review,status:currentReview?review.status:'not_reviewed',applies_to_current:currentReview};
 return {schema_version:1,scene_id:'T00',generated_at:now,repository:'https://github.com/bolechen/temple-walk',source:{sha,url:`https://github.com/bolechen/temple-walk/commit/${sha}`},
 delivery:{...delivery,record_commit:deliveryCommit,kind:'developer_report'},
 verification:{status:exact?.status||'pending',conclusion:exact?.conclusion||null,run_id:exact?.id||null,url:exact?.html_url||null,checks:verified?{syntax:check('Every script parses'),unit:check('Unit tests (the plan, the walker, the building generator, the seasons)'),e2e:check('End to end, startup and movement')}:{syntax:'pending',unit:'pending',e2e:'pending'},scope:['boot','stairs','drop']},
 deployment:{status:deployed?.head_sha===sha?'deployed':'not_current',sha:deployed?.head_sha||null,url:'https://bolechen.github.io/temple-walk/',run_url:deployed?.html_url||null},independent_review:independent};
}
async function api(path){const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY||'bolechen/temple-walk'}/${path}`,{headers:{Accept:'application/vnd.github+json',...(process.env.GH_TOKEN?{Authorization:`Bearer ${process.env.GH_TOKEN}`}:{})},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`GitHub ${r.status}: ${path}`);return r.json();}
export async function build(){
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const delivery=validateDelivery(JSON.parse(readFileSync('docs/t00/delivery.json','utf8')));
 const review=JSON.parse(readFileSync('docs/t00/independent-review.json','utf8'));
 if(review.scene_id!=='T00'||!['not_reviewed','pass','fail','partial','blocked'].includes(review.status)||!Array.isArray(review.issues)||!Array.isArray(review.evidence))throw Error('Invalid independent review');
 if(review.status!=='not_reviewed'&&(!shaPattern.test(review.reviewed_commit||'')||!review.reviewer||!review.evidence.length))throw Error('Review needs exact SHA, reviewer and evidence');
 const deliveryCommit=execFileSync('git',['log','-1','--format=%H','--','docs/t00/delivery.json'],{encoding:'utf8'}).trim();
 const [all,exact]=await Promise.all([api('actions/workflows/pages.yml/runs?branch=main&event=push&per_page=100'),api(`actions/workflows/pages.yml/runs?head_sha=${sha}&branch=main&per_page=10`)]);
 const runs=[...new Map([...all.workflow_runs,...exact.workflow_runs].map(r=>[r.id,r])).values()];
 const run=exact.workflow_runs.sort((a,b)=>b.id-a.id)[0];const jobs=run?(await api(`actions/runs/${run.id}/jobs?per_page=100`)).jobs:[];jobs.run_id=run?.id;
 const data=compose({sha,delivery,deliveryCommit,review,runs,jobs});
 mkdirSync('tools/out/status',{recursive:true});writeFileSync('tools/out/status/t00.json',JSON.stringify(data,null,2)+'\n');console.log(`T00 status: ${sha}, CI ${data.verification.conclusion||data.verification.status}, deployment ${data.deployment.status}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await build();
