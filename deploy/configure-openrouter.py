#!/usr/bin/env python3
"""Install an OpenRouter API key without echoing it or putting it in argv."""
import getpass,json,os,pathlib,subprocess,urllib.request,urllib.error
if os.geteuid()!=0:raise SystemExit('Run with sudo on the Oracle VM.')
key=getpass.getpass('OpenRouter API key (hidden): ').strip()
try:
 request=urllib.request.Request('https://openrouter.ai/api/v1/key',headers={'Authorization':'Bearer '+key})
 with urllib.request.urlopen(request,timeout=20) as response:data=json.load(response)['data']
except Exception:raise SystemExit('Key validation failed; nothing was saved.')
p=pathlib.Path('/opt/wally-assistant/hermes.env')
lines=[line for line in p.read_text().splitlines() if not line.startswith('OPENROUTER_API_KEY=')]
p.write_text('\n'.join(lines)+'\nOPENROUTER_API_KEY='+key+'\n');p.chmod(0o600)
pwa_env=pathlib.Path('/opt/wally-assistant/pwa.env')
pwa_lines=[line if not line.startswith('ASSISTANT_ENABLED=') else 'ASSISTANT_ENABLED=true' for line in pwa_env.read_text().splitlines()]
if not any(l.startswith('ASSISTANT_ENABLED=') for l in pwa_lines):pwa_lines.append('ASSISTANT_ENABLED=true')
pwa_env.write_text('\n'.join(pwa_lines)+'\n');pwa_env.chmod(0o600)
limit=data.get('limit')
print('Key validated and saved securely. Key limit:',(f'{limit} USD' if limit is not None else 'none (account balance)'))
subprocess.run(['docker','compose','--env-file','/opt/wally-assistant/runtime-image.env','-p','wally-assistant','-f','/home/ubuntu/wally-pwa-source/deploy/compose.yml','--profile','runtime','up','-d','--force-recreate','hermes','pwa'],check=True)
print('Hermes and PWA restarted with Assistant chat enabled.')
