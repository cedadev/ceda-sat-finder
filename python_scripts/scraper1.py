## Navigate to arsf directory
## Scan through years available
## Open yr/pcode/Docs/readme1.txt

## E. Compare readme1.txt and readme2.txt contents
## E. Extract metadata from readme files and add pcode as flight num, as well as readme

## 1. Python elasticsearch
## 1.1 check/count identical pcodes in arsf data

def findMatchingPcodes(response):
    # response - full elasticsearch json-style response
    is_path = False
    paths = []
    for x in range(len(response)-50):
        #print(response[x:x+4])
        if response[x:x+4] == 'path':
            # Assume "path":"/////",
            path_start = x+7
            is_path = True
        if response[x+1] == ',' and is_path:
            paths.append(response[path_start:x])
            is_path = False
    print('Found {} paths'.format(len(paths)))
    pdict = {}
    pconcat = []
    for path in paths:
        # ARSF specific pcode finder
        pcode = path.split('/')[4]
        try:
            pdict[pcode] += 1
        except:
            pdict[pcode] = 1
            pconcat.append(pcode)

    for pcode in pconcat:
        print(pcode, pdict[pcode])
    return None

f = open('response.txt')
content = f.readlines()
f.close()
findMatchingPcodes(content[0])

    
