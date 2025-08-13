#!/bin/bash

# TODO: Remove -s merged from gh CLI commands

v3Result=`gh -R wri/terramatch-microservices pr list --search "head:release" -s merged -L 1 --json headRefName,title`
v3Title=`echo $v3Result | jq -r .[].title`
v3Branch=`echo $v3Result | jq -r .[].headRefName`

phpResult=`gh -R wri/wri-terramatch-api pr list --search "head:release" -s merged -L 1 --json headRefName,title`
phpTitle=`echo $phpResult | jq -r .[].title`
phpBranch=`echo $phpResult | jq -r .[].headRefName`

feResult=`gh -R wri/wri-terramatch-website pr list --search "head:release" -s merged -L 1 --json headRefName,title`
feTitle=`echo $feResult | jq -r .[].title`
feBranch=`echo $feResult | jq -r .[].headRefName`

echo "Found PRs:";
echo "  v3: $v3Title, $v3Branch";
echo "  PHP: $phpTitle, $phpBranch";
echo "  FE: $feTitle, $feBranch";

echo -e "\nJira Tickets:"
curl \
  --get -s \
  -u $JIRA_USER:$JIRA_TOKEN \
  --data-urlencode "jql=fixVersion=\"Kindred Kunzite\"" \
  "https://gfw.atlassian.net/rest/api/3/search" | jq -r ".issues[].key"

echo -e "\nv3 Tickets:"
gh -R wri/terramatch-microservices pr view $v3Branch --json commits -q ".commits[] .messageHeadline" | sed "s/.*\(TM-[0-9]*\).*/\1/" | sort | uniq | grep "TM-"

echo -e "\nPHP Tickets:"
gh -R wri/wri-terramatch-api pr view $phpBranch --json commits -q ".commits[] .messageHeadline" | sed "s/.*\(TM-[0-9]*\).*/\1/" | sort | uniq | grep "TM-"

echo -e "\nFE Tickets:"
gh -R wri/wri-terramatch-website pr view $feBranch --json commits -q ".commits[] .messageHeadline" | sed "s/.*\(TM-[0-9]*\).*/\1/" | sort | uniq | grep "TM-"
