<div align="center">
  <a href="https://juicyllama.com/" target="_blank">
    <img src="https://juicyllama.com/assets/images/icon.png" width="100" alt="JuicyLlama Logo" />
  </a>

Visit the [JuicyLlama](https://juicyllama.com) to learn more.
</div>

## Development

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

### Pre-commit Hooks

This project uses Husky and lint-staged for pre-commit hooks:
- **Pre-commit**: Runs ESLint and Prettier on staged files
- **Commit-msg**: Validates commit messages using commitlint

The hooks ensure code quality and consistency before commits are made.
