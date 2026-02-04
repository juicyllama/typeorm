## Development

### Branch Development

All development should happen on a new git branch.

Once you are finished and you have passed the [Let's Go!](#lets-go) checks, you should create a PR request on github.

Tag repository owners for manual review.

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) specification. All commit messages are validated using commitlint.

**Format:** `type(scope): description`

**Allowed types:**
- `feat` / `feature`: A new feature
- `fix` / `fixes`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit
- `patch`: Small patches or hotfixes
- `minor`: Minor changes or improvements
- `major`: Major changes or breaking changes
- `breaking`: Breaking changes
- `misc`: Miscellaneous changes

**Examples:**
```
feat: add new string utility function
fix: resolve issue with date parsing
docs: update API documentation
test: add unit tests for geocoding utils
```

### Let's Go!

ALWAYS Run `npm run go` before any commit to make sure all changes pass the CI/CD pipeline.

Fix any errors found. 