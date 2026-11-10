# ECR Stage03 — proposed exact CI admission

PROPOSED / CI_POLICY_APPROVAL_PENDING. Task ARCHITECTURE-ECR-STAGE03-DURABLE-STORE-20261110.

PR947 (architecture/ecr-stage03-durable-store-20261110), source 995c2b5f385b515d647e6d770d77873503815311, base 3d1eb89373fbb1d6d358b7c0a40726a0fe8c5c62:42 exact regular-file versions, all actual ARCHITECTURE owners/surfaces. The current trusted policy has no generic ECR/SourceHub runtime admission and rejects SDK1.6.0's unchanged exact authority peer range as LOCAL_DEPENDENCY_REJECTED. This proposal admits only those42 reviewed blob/status/mode bindings and the exact1.6.0 peer metadata. It preserves all prior ECR, ACG and Oil reviews, main-only Environment, read:packages credential, token-removal, full-diff, race, exact-candidate and resulting-main proof rules. No generic runtime path is opened.

After separate owner acceptance, require normal four-file bootstrap CI and trusted-main controlled proof before policy adoption. Then validate the exact refreshed PR947 head, all producer/consumer/security checks and actual merged-main checks. The policy does not install migrations, grant source/storage access, create resources or deploy. Those depend on the distinct exact Stage03 owner packet and its activation readback. No force/admin merge, fake proof or changed workflow is permitted.

Entry-map SHA-256: cb0bfee1e807211a0f091ded9f7c47205ded1954c7a8e22071718d9d201fe019. Source closure/owner packet: https://github.com/profitia/SG-dev/pull/947.
