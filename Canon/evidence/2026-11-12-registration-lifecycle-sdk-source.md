# Stage I lifecycle SDK source successor

Task ARCH-REGISTRATION-LIFECYCLE-SDK-SOURCE-20261112. Work in progress, NOT an accepted source or runtime activation.

The candidate versions the shared SDK as 1.37.0, preserving default Root16 and explicit optional Root23. Current Identity, Limits and authority dependency metadata follow the same SDK; the four existing optional packages gain only the exact new peer version. Their executable code is unchanged. Joint source closure and consumer adoptions are still being assembled.

The first clean Identity dependency installation correctly rejected the existing authority package's exact 1.36.0 peer. Its bounded peer metadata must be updated through the Architecture owner before complete tests and source acceptance. No forced dependency resolution, fake package, skipped check or credentials were used.

No live SQL, grants, configuration, provider/mail calls or deployment. Business runtime remains pending.
