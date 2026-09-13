# SharpTalk-VN-Go2Joy — server secrets (TEMPLATE — copy to secrets/SharpTalk-VN-Go2Joy-server.md, gitignored)

> Values live ONLY in `secrets/` on an operator machine and on the server itself.
> Never paste them into docs, PRs, issues or chat.

## Connection
| | |
|---|---|
| Host (IP) | |
| DNS | talk-vn.<DOMAIN> |
| Cloud / region | |
| SSH user | |
| SSH key | `secrets/ssh/<key>` |
| App / deploy path | `/home/<user>/sharptalk` |
| Public web | https://talk-vn.<DOMAIN>/ |
| Public widget | https://talk-vn.<DOMAIN>/widget/ |
| Public API | https://talk-vn.<DOMAIN>/api/v1 (health: /api/v1/health) |
| TLS termination | host nginx / Caddy / LB — cert renewal: |
| Backup target | (in-country object storage / host) |

## Deploy quickstart
```bash
ssh -i secrets/ssh/<key> <user>@<host>
cd ~/sharptalk && git pull --ff-only origin main
MYSQL_CONTAINER=sharptalk_mysql bash scripts/check-migrations.sh
bash scripts/deploy-self-hosted.sh
```

## App logins (passwords elsewhere — password manager)
| Account | Role | Note |
|---|---|---|
| admin@… | platform super_admin | MFA |
| <master>@… | tenant master | |

## Admin (root) — server maintenance
| | |
|---|---|
| Console / provider | |
| Emergency contact | |

## Log (newest first)
- YYYY-MM-DD — first deploy (main <sha>), schema init-sql, SEED_ON_BOOT turned off
