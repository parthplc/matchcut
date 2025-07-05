import requests
import json
from bs4 import BeautifulSoup

google_rss_url = 'https://news.google.com/rss/articles/CBMiogFBVV95cUxQLUFubVFtajlobFdKQllBb1JBRDNPNm8yRE51a0N2STl3SGd6eFY2cEVMdllnM1VwNGRBbWxsa0FLUGViaHNaN2p2R2oyMWFsNklvM3pFdXZFWjNNT1dNN2lrclRzWTlLOEpOLXYzZzdETnFMS0ZUZktvZTREcmU0ZzZucmFYZk0tR1gzTVlEUWh4dXVpMGMxSWltb2x2enl1TEE?oc=5'

resp = requests.get(google_rss_url)
data = BeautifulSoup(resp.text, 'html.parser').select_one('c-wiz[data-p]').get('data-p')
obj = json.loads(data.replace('%.@.', '["garturlreq",'))

payload = {
    'f.req': json.dumps([[['Fbv4je', json.dumps(obj[:-6] + obj[-2:]), 'null', 'generic']]])
}

headers = {
  'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
}

url = "https://news.google.com/_/DotsSplashUi/data/batchexecute"
response = requests.post(url, headers=headers, data=payload)
array_string = json.loads(response.text.replace(")]}'", ""))[0][2]
article_url = json.loads(array_string)[1]

print(article_url)
