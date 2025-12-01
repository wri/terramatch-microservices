#!/bin/bash

# See https://gfw.atlassian.net/wiki/spaces/TerraMatch/pages/967475206/Release+Process+and+Branching+Strategy#Release-Audit-Script
# for setup and usage instructions.

if [[ -z "$JIRA_USER" || -z "$JIRA_TOKEN" ]]; then
  echo "Please set the JIRA_USER and JIRA_TOKEN env variables."
  exit 100
fi

echo "Enter release name:"
read release

jql=$(echo "fixVersion=\"$release\"" | jq -SRr @uri)
jiraTicketsResponse=$(curl \
  -s \
  -u "$JIRA_USER":"$JIRA_TOKEN" \
  "https://gfw.atlassian.net/rest/api/3/search/jql?jql=$jql&fields=key")
error=$(echo "$jiraTicketsResponse" | jq ".errorMessages")
if [[ $error != "null" ]]; then
  echo "Release not found in Jira: $release"
  echo "Error: $error"
  exit 100
fi

v3Result=$(gh -R wri/terramatch-microservices pr list --search "head:release" -L 1 --json headRefName,title)
v3Title=$(echo "$v3Result" | jq -r .[].title)
v3Branch=$(echo "$v3Result" | jq -r .[].headRefName)

phpResult=$(gh -R wri/wri-terramatch-api pr list --search "head:release" -L 1 --json headRefName,title)
phpTitle=$(echo "$phpResult" | jq -r .[].title)
phpBranch=$(echo "$phpResult" | jq -r .[].headRefName)

feResult=$(gh -R wri/wri-terramatch-website pr list --search "head:release" -L 1 --json headRefName,title)
feTitle=$(echo "$feResult" | jq -r .[].title)
feBranch=$(echo "$feResult" | jq -r .[].headRefName)

# Enable case-insensitive matching
shopt -s nocasematch
if [[ ! ($v3Title =~ $release && $phpTitle =~ $release && $feTitle =~ $release) ]]; then
  echo -e "\nOne or more PR not found. Current release branches:"
  echo "  v3: $v3Title, $v3Branch"
  echo "  PHP: $phpTitle, $phpBranch"
  echo "  FE: $feTitle, $feBranch"
  exit 100
fi
# Disable case-insensitive matching
shopt -u nocasematch

echo -e "\nFound PRs:"
echo "  v3: $v3Title, $v3Branch"
echo "  PHP: $phpTitle, $phpBranch"
echo "  FE: $feTitle, $feBranch"

jiraTickets=$(echo "$jiraTicketsResponse" | jq -r ".issues[].key" | sort)
echo -e "\nJira Tickets:\n$jiraTickets"

v3Tickets=$(gh -R wri/terramatch-microservices pr view "$v3Branch" --json commits -q ".commits[] .messageHeadline" \
  | sed "s/.*\(TM-[0-9]*\).*/\1/" | sort | uniq | grep "TM-")
echo -e "\nv3 Tickets:\n$v3Tickets"

phpTickets=$(gh -R wri/wri-terramatch-api pr view "$phpBranch" --json commits -q ".commits[] .messageHeadline" \
  | sed "s/.*\(TM-[0-9]*\).*/\1/" | sort | uniq | grep "TM-")
echo -e "\nPHP Tickets:\n$phpTickets"

feTickets=$(gh -R wri/wri-terramatch-website pr view "$feBranch" --json commits -q ".commits[] .messageHeadline" \
  | sed "s/.*\(TM-[0-9]*\).*/\1/" | sort | uniq | grep "TM-")
echo -e "\nFE Tickets:\n$feTickets"

codeTickets=$(echo -e "$v3Tickets\n$phpTickets\n$feTickets" | sort | uniq)

# In each of these comparisons, include the second list twice so that tickets that are in second
# list but not in the first are left out of that comparison.
echo -e "\nIn Jira but missing committed code:"
echo -e "$jiraTickets\n$codeTickets\n$codeTickets" | sort | uniq -u

echo -e "\nIn v3 code, but missing in Jira:"
echo -e "$v3Tickets\n$jiraTickets\n$jiraTickets" | sort | uniq -u

echo -e "\nIn PHP code, but missing in Jira:"
echo -e "$phpTickets\n$jiraTickets\n$jiraTickets" | sort | uniq -u

echo -e "\nIn FE code, but missing in Jira:"
echo -e "$feTickets\n$jiraTickets\n$jiraTickets" | sort | uniq -u
