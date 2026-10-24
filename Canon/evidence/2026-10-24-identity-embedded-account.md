# Identity embedded account — Development candidate

Task: ARCHITECTURE-EMBEDDED-ACCOUNT-20261024. PMOS begin cmvmtzh3l00004szeyys2ks6r, Architecture control plane only. Source baseline 53704235d287e05e631aa3e51b0fc1701e41da79.

This additive, default-off ingress enables the reviewed PORR SRM presentation to reuse canonical registration and ACCOUNT_SELF. No database migration, grant, new provider identity authority or change to published platform contracts. Existing SG2 navigation is preserved.

Local types/build/lint, the new 15 origin/session/projection tests, and all 335 existing/new session, registration, email and real isolated PostgreSQL assertions pass (sequential execution); live deployment and mailbox acceptance remain pending and must not be inferred from this source receipt.

Design owner and consumer acceptance are in the separate SRM-PORR-ACCOUNT-20261024 task. Deployment/LKG evidence will be published to canonical PMOS after runtime validation.
