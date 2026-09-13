# SharpTalk-KR-Production — server secrets (TEMPLATE — copy to secrets/SharpTalk-KR-Production-server.md, gitignored)

> Values live ONLY in `secrets/` on an operator machine and on the server. Never paste them into docs, PRs, issues or chat.
> Claude may READ this file to move values into the server's env; it never types passwords into browsers.

## Connection
| | |
|---|---|
| Host (IP) | |
| DNS | sharptalk.amoeba.site |
| Provider / region / plan | |
| Bootstrap (root/sudo) user | root · key: `secrets/ssh/<key>` |
| Deploy user | sharptalk · key: same or `secrets/ssh/<key>` |
| App / deploy path | `/home/sharptalk/sharptalk` |
| Public web / widget / API | https://sharptalk.amoeba.site/ · /widget/ · /api/v1 (health /api/v1/health) |
| TLS | host nginx + Let's Encrypt (certbot, no --redirect) — renewal: certbot.timer |
| Backup target (off-host, in-country) | |

## Real keys (filled by the operator; copied to docker/self-hosted/.env.self-hosted on the server)
| Key | Value | Source |
|---|---|---|
| ANTHROPIC_API_KEY | | Anthropic console |
| VOYAGE_API_KEY | | Voyage dashboard |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / ALERT_EMAIL_FROM / ALERT_EMAIL_TO | | mail provider |
| SHOPIFY_API_KEY / SHOPIFY_API_SECRET / SHOPIFY_WEBHOOK_SECRET / SHOPIFY_SCOPES | | Partner dashboard (same app as staging, D5) |
| FULFILLMENT_WEBHOOK_SECRET | | generate (openssl rand -hex 32) |
| SEED_PASSWORD | | generate; change on first login |
| CERTBOT e-mail | | ops mailbox |

## App logins (passwords in the password manager, not here)
| Account | Role |
|---|---|
| admin@amoeba.group | platform super_admin (MFA) |
| dev@amoeba.group | tenant master ivyusa |

## Deploy quickstart
```bash
ssh -i secrets/ssh/<key> sharptalk@<host>
cd ~/sharptalk && git pull --ff-only origin production
MYSQL_CONTAINER=sharptalk_mysql bash scripts/check-migrations.sh
bash scripts/deploy-self-hosted.sh
```

## Log (newest first)
- YYYY-MM-DD — provisioned (provision-host.sh), first deploy main <sha>, seed applied, SEED_ON_BOOT off
