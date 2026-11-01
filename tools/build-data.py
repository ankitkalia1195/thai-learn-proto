#!/usr/bin/env python3
"""Usage: build-data.py path/to/story_checked.json  -> writes data/story.js (window.STORY_RAW)."""
import json,sys,os
src=sys.argv[1]
d=json.load(open(src,encoding='utf-8'))
out=os.path.join(os.path.dirname(__file__),'..','data','story.js')
open(out,'w',encoding='utf-8').write('window.STORY_RAW='+json.dumps(d,ensure_ascii=False)+';\n')
print('wrote',out)
