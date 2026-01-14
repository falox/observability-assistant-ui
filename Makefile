.PHONY: install dev build lint preview clean

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

lint:
	pnpm lint

preview:
	pnpm preview

clean:
	rm -rf dist node_modules
