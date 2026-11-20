import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {compose,validateDelivery} from '../../tools/status/build.mjs';
const require=createRequire(import.meta.url);
const deployedCjs=require('../../tools/ci/deployed.cjs'),changesCjs=require('../../tools/ci/changes.cjs');
const sha='a'.repeat(40), old='b'.repeat(40);
const delivery={schema_version:1,scene_id:'T00',summary:'Development report',changes:[],known_issues:[],evidence:[]};
const run=(id,head,conclusion)=>({id,head_sha:head,status:'completed',conclusion,html_url:`https://github.com/run/${id}`});
const base=()=>({sha,delivery,deliveryCommit:old,review:{status:'pass',reviewed_commit:old,reviewer:'external',issues:[],evidence:['old.png']},runs:[],jobs:[]});
test('old review cannot approve current source',()=>{const d=compose(base());assert.equal(d.independent_review.status,'not_reviewed');assert.equal(d.independent_review.reviewed_commit,old);assert.equal(d.deployment.status,'not_current');assert.equal(d.verification.status,'pending');});
test('failed current CI preserves last deployed commit',()=>{const b=base();b.runs=[run(2,sha,'failure'),run(1,old,'success')];b.deployed=run(1,old,'success');const d=compose(b);assert.equal(d.verification.conclusion,'failure');assert.equal(d.deployment.sha,old);assert.equal(d.deployment.status,'not_current');});
test('successful pipeline does not imply independent acceptance',()=>{const b=base();b.runs=[run(3,sha,'success')];b.deployed=run(3,sha,'success');const d=compose(b);assert.equal(d.deployment.status,'deployed');assert.equal(d.independent_review.status,'not_reviewed');});
test('job evidence must belong to the selected run',()=>{const b=base();b.runs=[run(3,sha,'failure')];b.jobs=[{steps:[{name:'Every script parses',conclusion:'success'}]}];b.jobs.run_id=2;assert.equal(compose(b).verification.checks.syntax,'pending');b.jobs.run_id=3;assert.equal(compose(b).verification.checks.syntax,'success');});
test('developer record rejects missing lists',()=>assert.throws(()=>validateDelivery({...delivery,known_issues:null})));
test('invalid source SHA is rejected',()=>assert.throws(()=>compose({...base(),sha:'main'})));

// #299: the board's "deployed" is the commit whose deploy job succeeded, found where tools/ci/changes.cjs finds it.
const jobsOf=(deployConclusion)=>({jobs:[{name:'verify',conclusion:'success'},{name:'deploy',conclusion:deployConclusion}]});
/** A fake of the Actions API: successful runs newest first, and each run's jobs. */
const history=(runs,jobs)=>async(path)=>{
  if(path.startsWith('actions/workflows/pages.yml/runs'))return{workflow_runs:runs};
  const m=path.match(/^actions\/runs\/(\d+)\/jobs/);if(m&&jobs[m[1]])return jobs[m[1]];
  throw Error('unexpected '+path);
};
const x='c'.repeat(40),docs1='d'.repeat(40),docs2='e'.repeat(40);
test('a successful run that deployed nothing does not move "deployed"',async()=>{
  // newest first: two runs of papers alone (success, deploy skipped), then the run that deployed x
  const runs=[run(9,docs2,'success'),run(8,docs1,'success'),run(7,x,'success')];
  const get=history(runs,{9:jobsOf('skipped'),8:jobsOf('skipped'),7:jobsOf('success')});
  const deployed=await deployedCjs.findLastDeploy(get);
  assert.equal(deployed.head_sha,x);assert.equal(deployed.id,7);
  const d=compose({...base(),sha:docs2,runs,deployed});
  assert.equal(d.deployment.sha,x,'the board names the commit that was deployed, not the newest successful run');
  assert.equal(d.deployment.status,'not_current');assert.equal(d.deployment.run_url,'https://github.com/run/7');
  // the old reading, for the record: the newest successful run is a papers-only one
  assert.equal(runs.filter(r=>r.conclusion==='success').sort((a,b)=>b.id-a.id)[0].head_sha,docs2);
});
test('when the newest run did deploy, that is the answer and it is current',async()=>{
  const runs=[run(9,sha,'success'),run(7,x,'success')];
  const deployed=await deployedCjs.findLastDeploy(history(runs,{9:jobsOf('success'),7:jobsOf('success')}));
  assert.equal(compose({...base(),runs,deployed}).deployment.status,'deployed');
});
test('no deploy in the history: the board says so, and does not guess',async()=>{
  const runs=[run(9,docs1,'success')];
  const deployed=await deployedCjs.findLastDeploy(history(runs,{9:jobsOf('skipped')}));
  assert.equal(deployed,null);
  const d=compose({...base(),runs,deployed});assert.equal(d.deployment.sha,null);assert.equal(d.deployment.status,'not_current');
});
test('the board and the build comparison ask the same function (tools/ci/deployed.cjs)',()=>{
  assert.equal(changesCjs.findLastDeploy,deployedCjs.findLastDeploy);
  const src=fs.readFileSync(new URL('../../tools/status/build.mjs',import.meta.url),'utf8'),ci=fs.readFileSync(new URL('../../tools/ci/changes.cjs',import.meta.url),'utf8');
  assert.match(src,/\{findLastDeploy\}=createRequire\(import\.meta\.url\)\('\.\.\/ci\/deployed\.cjs'\)/);assert.match(src,/findLastDeploy\(api\)/);
  assert.doesNotMatch(src,/deployed=runs\.filter/,'a second way of finding the deployed run');
  assert.match(ci,/findLastDeploy\(get/);assert.doesNotMatch(ci,/select\(\.name == "deploy"/,'a second way of reading the deploy job');
});
