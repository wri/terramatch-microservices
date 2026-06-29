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

beResult=$(gh -R wri/terramatch-microservices pr list --search "head:release" -L 1 --json headRefName,title,number)
beTitle=$(echo "$beResult" | jq -r .[].title)
beBranch=$(echo "$beResult" | jq -r .[].headRefName)
beNumber=$(echo "$beResult" | jq -r .[].number)

feResult=$(gh -R wri/wri-terramatch-website pr list --search "head:release" -L 1 --json headRefName,title,number)
feTitle=$(echo "$feResult" | jq -r .[].title)
feBranch=$(echo "$feResult" | jq -r .[].headRefName)
feNumber=$(echo "$feResult" | jq -r .[].number)

# Enable case-insensitive matching
shopt -s nocasematch
if [[ ! ($beTitle =~ $release && $feTitle =~ $release) ]]; then
  echo -e "\nOne or more PR not found. Current release branches:"
  echo "  BE: $beTitle, $beBranch, $beNumber"
  echo "  FE: $feTitle, $feBranch, $feNumber"
  exit 100
fi
# Disable case-insensitive matching
shopt -u nocasematch

echo -e "\nFound PRs:"
echo "  BE: $beTitle, $beBranch, $beNumber"
echo "  FE: $feTitle, $feBranch, $feNumber"

jiraTickets=$(echo "$jiraTicketsResponse" | jq -r ".issues[].key" | sort)
echo -e "\nJira Tickets:\n$jiraTickets"

# gh pr view has a hidden limit of 100 commits. The only way to work around it is to run our own
# GraphQL query with pagination.
query=$(cat << QUERY
  query(\$repo: String!, \$pr: Int!, \$endCursor: String) {
    repository(owner: "wri", name: \$repo) {
      pullRequest(number: \$pr) {
        commits(first: 100, after: \$endCursor) {
          pageInfo { hasNextPage, endCursor }
          nodes { commit { messageHeadline } }
        }
      }
    }
  }
QUERY
)

beTickets=$(gh api graphql \
  -F repo='terramatch-microservices' \
  -F pr="$beNumber" \
  -q '.data.repository.pullRequest.commits.nodes[].commit.messageHeadline' \
  --paginate \
  -f query="$query" \
  | sed "s/.*\(TM-[0-9]*\).*/\1/" | sort | uniq | grep "TM-[0-9]")
echo -e "\nBE Tickets:\n$beTickets"

feTickets=$(gh api graphql \
  -F repo='wri-terramatch-website' \
  -F pr="$feNumber" \
  -q '.data.repository.pullRequest.commits.nodes[].commit.messageHeadline' \
  --paginate \
  -f query="$query" \
  | sed "s/.*\(TM-[0-9]*\).*/\1/" | sort | uniq | grep "TM-[0-9]")
echo -e "\nFE Tickets:\n$feTickets"

codeTickets=$(echo -e "$beTickets\n$feTickets" | sort | uniq)

# In each of these comparisons, include the second list twice so that tickets that are in second
# list but not in the first are left out of that comparison.
echo -e "\nIn Jira but missing committed code:"
echo -e "$jiraTickets\n$codeTickets\n$codeTickets" | sort | uniq -u | sed 's/.*/https:\/\/gfw.atlassian.net\/browse\/&/'

echo -e "\nIn BE code, but missing in Jira:"
echo -e "$beTickets\n$jiraTickets\n$jiraTickets" | sort | uniq -u | sed 's/.*/https:\/\/gfw.atlassian.net\/browse\/&/'

echo -e "\nIn FE code, but missing in Jira:"
echo -e "$feTickets\n$jiraTickets\n$jiraTickets" | sort | uniq -u | sed 's/.*/https:\/\/gfw.atlassian.net\/browse\/&/'
