import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Typography } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { COMPONENT_REGISTRY } from './registry';
import { ComponentsShowcase } from './ComponentsShowcase';

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Components',
    description:
      'Internal reference of every base UI component in this template — registry table plus live, interactive previews.',
    path: '/components',
    noIndex: true,
  });
}

export default function ComponentsPage() {
  return (
    <>
      <Header />
      <PageWrapper>
        <Typography variant="h1" className="mb-3">
          Component Library
        </Typography>
        <Typography variant="lead" className="mb-10 max-w-2xl text-foreground-muted">
          Every base component available in this template — registry below, live previews further
          down the page.
        </Typography>

        <section aria-labelledby="registry-heading" className="mb-16">
          <Typography as="h2" variant="h3" id="registry-heading" className="mb-4">
            Registry
          </Typography>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableCaption className="sr-only">
                All base UI components available in this template
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Import path</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPONENT_REGISTRY.map((entry) => (
                  <TableRow key={entry.name}>
                    <TableCell className="font-medium text-foreground">{entry.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entry.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs text-foreground-muted">
                      {entry.description}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground-subtle">
                      {entry.importPath}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={entry.status === 'New' ? 'default' : 'success'} dot>
                        {entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="live-preview-heading">
          <Typography as="h2" variant="h3" id="live-preview-heading" className="mb-4">
            Live previews
          </Typography>
          <ComponentsShowcase />
        </section>
      </PageWrapper>
      <Footer />
    </>
  );
}
