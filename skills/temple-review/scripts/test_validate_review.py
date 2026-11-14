"""Regression tests: evidence fraud, scope mistakes, and portable installation."""
import copy
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('validator', HERE / 'validate_review.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root/'check.log').write_text('actual check output\n')
        self.report = dict(schema_version='1.0', run_id='test', source=dict(repository='owner/repo',ref='main',reviewed_commit='a'*40,observed_head='a'*40), change_kind='docs',run_status='completed',environment=dict(target_device=False),checks=[dict(id='docs',status='pass',criterion='links readable',reason='checked output',scope='static',commit='a'*40,evidence_ids=['log'])], artifacts=[dict(id='log',type='test_log',mode='static',created_at='2026-11-14T00:00:00Z',commit='a'*40,file='check.log',sha256=hashlib.sha256((self.root/'check.log').read_bytes()).hexdigest())],issues=[],verdict='accepted',publish=dict(requested=False,status='not_requested'))
    def rejects(self):
        self.assertTrue(v.validate(self.report,self.root))
    def test_valid_local_evidence(self):
        self.assertEqual([],v.validate(self.report,self.root))
    def test_stale_commit(self):
        self.report['artifacts'][0]['commit']='b'*40
        self.rejects()
    def test_forged_hash(self):
        self.report['artifacts'][0]['sha256']='0'*64
        self.rejects()
    def test_path_escape(self):
        self.report['artifacts'][0]['file']='../outside.log'
        self.rejects()
    def test_generated_image_is_not_runtime(self):
        self.report['checks'][0]['scope']='visual'
        self.report['artifacts'][0]['type']='generated_reference'
        self.rejects()
    def test_diagnostic_does_not_prove_input(self):
        self.report['checks'][0]['scope']='runtime'
        self.report['artifacts'][0]['mode']='diagnostic'
        self.rejects()
    def test_actual_input_runtime(self):
        self.report['checks'][0]['scope']='runtime'
        self.report['artifacts'][0]['mode']='user_input'
        self.assertEqual([],v.validate(self.report,self.root))
    def test_gpu_is_not_target_device(self):
        self.report['checks'][0]['scope']='performance'
        self.report['artifacts'][0]['type']='performance_data'
        self.rejects()
    def test_closed_issue_needs_retest(self):
        self.report['issues']=[dict(id='T00-1',severity='major',state='verified_closed',finding='missing model',recommendation='restore model')]
        self.rejects()
    def test_open_major_prevents_acceptance(self):
        self.report['issues']=[dict(id='T00-1',severity='major',state='open',finding='missing model',recommendation='restore model')]
        self.rejects()
    def test_no_change(self):
        self.report.update(change_kind='no_change',run_status='no_change',verdict='no_change',checks=[],artifacts=[])
        self.assertEqual([],v.validate(self.report,self.root))
        self.report['change_kind']='code'
        self.rejects()
    def test_publish_requires_version(self):
        self.report['publish']=dict(status='succeeded',requested=True,url='https://example.org')
        self.rejects()
    def test_malformed_arrays(self):
        for field in ('checks','artifacts','issues'):
            report=copy.deepcopy(self.report)
            report[field]=None
            self.assertTrue(v.validate(report,self.root))
    def test_unfilled_template_rejected(self):
        report=json.loads((HERE.parent/'references/review-template.json').read_text())
        self.assertTrue(v.validate(report,self.root))

class InstallationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Canonical layout is the same in repo and the downloaded portable package.
        cls.repo=HERE.parents[2]
        cls.installer=cls.repo/'tools/install-review-skill.py'
    def setUp(self):
        if not self.installer.exists():
            self.skipTest('installer not included in this standalone skill copy')
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
    def run_install(self,*args):
        return subprocess.run([sys.executable,str(self.installer),'--root',str(self.root),*args],capture_output=True,text=True)
    def test_install_and_idempotence(self):
        self.assertEqual(0,self.run_install().returncode)
        for client in ('.claude','.agents'):
            self.assertTrue((self.root/client/'skills/temple-review/SKILL.md').is_file())
        self.assertIn('Already current',self.run_install().stdout)
    def test_refuse_modified_and_explicit_replace(self):
        self.assertEqual(0,self.run_install().returncode)
        target=self.root/'.claude/skills/temple-review/SKILL.md'
        target.write_text('local edits')
        self.assertNotEqual(0,self.run_install().returncode)
        self.assertEqual('local edits',target.read_text())
        self.assertEqual(0,self.run_install('--replace').returncode)
        self.assertTrue(target.read_text().startswith('---'))
    def test_escape_symlink(self):
        with tempfile.TemporaryDirectory() as outside:
            (self.root/'.claude').symlink_to(outside,target_is_directory=True)
            self.assertNotEqual(0,self.run_install().returncode)
            self.assertFalse((Path(outside)/'skills').exists())

if __name__=='__main__':
    unittest.main()
