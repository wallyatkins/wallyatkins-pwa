#!/usr/bin/env python3
"""Install a dedicated key without echoing it, putting it in argv, or enabling inference."""
import getpass,json,os,pathlib,urllib.request,urllib.error
if os.geteuid()!=0:raise SystemExit('Run with sudo on the Oracle VM.')
key=getpass.getpass('Dedicated OpenRouter API key (hidden): ').strip()
try:
 request=urllib.request.Request('https://openrouter.ai/api/v1/key',headers={'Authorization':'Bearer '+key})
 with urllib.request.urlopen(request,timeout=20) as response:data=json.load(response)['data']
except Exception:raise SystemExit('Key validation failed; nothing was saved.')
if data.get('limit') is None:raise SystemExit('Set a spending limit on this dedicated key in OpenRouter first; nothing was saved.')
p=pathlib.Path('/opt/wally-assistant/hermes.env')
lines=[line for line in p.read_text().splitlines() if not line.startswith('OPENROUTER_API_KEY=')]
p.write_text('\n'.join(lines)+'\nOPENROUTER_API_KEY='+key+'\n');p.chmod(0o600)
print('Key validated and saved securely. Key limit:',data.get('limit'),'USD; reset:',data.get('limit_reset') or 'not configured')
print('Chat remains disabled pending model, budget, and live integration validation.')
