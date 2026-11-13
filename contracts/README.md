# NEARMARK contracts

The initial release contains `near-gate`, a narrow native-NEAR payment-control contract. It is compiled with the repository-pinned Rust toolchain, covered by Rust unit tests, and exercised by a modern `near-workspaces` local Sandbox integration test.

The maintained release runner (`bash scripts/NEARMARK-ONE-CLICK.sh`) offers an explicitly confirmed Testnet deployment and live smoke-test path. It never deploys to Mainnet. The owner retains a Full Access recovery key locally; the agent's separate FunctionCall key is constrained by NEAR protocol state to the Gate's `execute_payment` method.

The Gate is not independently audited. It does not handle FT/NFT transfers or arbitrary contract calls, and a successful local or Testnet run is not a production security certification. Read `near-gate/README.md`, `docs/IMPLEMENTATION-STATUS.md` and `docs/ONE-CLICK-RELEASE.md` before presenting the result.
