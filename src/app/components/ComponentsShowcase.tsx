'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, Mail, Plus, Settings, User } from 'lucide-react';

import { frameworkService } from '@/services';
import { useToast } from '@/hooks';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Typography } from '@/components/ui/Typography';
import { Combobox } from '@/components/ui/Combobox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface DemoSectionProps {
  id: string;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}

function DemoSection({ id, title, description, className, children }: DemoSectionProps) {
  return (
    <Card className={cn('flex flex-col gap-6', className)}>
      <CardHeader>
        <CardTitle id={id} className="text-lg">
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  );
}

function FormsSection() {
  const [comboboxValue, setComboboxValue] = useState<string | null>(null);
  const { data: frameworkOptions = [], isFetching } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => frameworkService.list(),
  });

  return (
    <DemoSection
      id="forms"
      title="Forms"
      description="Inputs, choice controls, and the new Combobox — backed by GET /api/frameworks."
      className="lg:col-span-2"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Input label="Email" placeholder="you@example.com" leftAddon={<Mail className="h-4 w-4" />} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="showcase-textarea">Message</Label>
            <Textarea id="showcase-textarea" placeholder="Write something…" rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="showcase-select">Select (short list)</Label>
            <Select>
              <SelectTrigger id="showcase-select" className="w-full">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="showcase-combobox">Combobox (searchable, API-backed)</Label>
            <Combobox
              options={frameworkOptions}
              value={comboboxValue}
              onValueChange={setComboboxValue}
              loading={isFetching && frameworkOptions.length === 0}
              placeholder="Search frameworks…"
              searchPlaceholder="Type to filter…"
              emptyText="No framework found."
              aria-label="Framework combobox"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Checkbox id="showcase-checkbox" defaultChecked />
            <Label htmlFor="showcase-checkbox">Email me about product updates</Label>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Plan</Label>
            <RadioGroup defaultValue="pro">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="free" id="plan-free" />
                <Label htmlFor="plan-free">Free</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pro" id="plan-pro" />
                <Label htmlFor="plan-pro">Pro</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="team" id="plan-team" />
                <Label htmlFor="plan-team">Team</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="showcase-switch">Dark mode</Label>
              <Typography variant="muted" className="mt-0.5">
                Always on in this template
              </Typography>
            </div>
            <Switch id="showcase-switch" defaultChecked disabled />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {(['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const).map(
              (variant) => (
                <Button key={variant} variant={variant} size="sm">
                  {variant}
                </Button>
              ),
            )}
          </div>
        </div>
      </div>
    </DemoSection>
  );
}

function DataDisplaySection() {
  return (
    <DemoSection
      id="data-display"
      title="Data Display"
      description="Badge, Avatar, and Typography — see the registry table above for Table."
    >
      <div className="flex flex-wrap gap-2">
        {(['default', 'secondary', 'outline', 'destructive', 'success', 'warning'] as const).map(
          (variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ),
        )}
      </div>

      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback>JT</AvatarFallback>
        </Avatar>
      </div>

      <div className="flex flex-col gap-1">
        <Typography variant="h6">Typography</Typography>
        <Typography variant="p">Body paragraph text.</Typography>
        <Typography variant="muted">Muted helper text.</Typography>
        <Typography variant="code">const x = 1;</Typography>
      </div>
    </DemoSection>
  );
}

function LayoutSection() {
  return (
    <DemoSection id="layout" title="Layout" description="Card, Separator, Accordion, and Tabs.">
      <div>
        <Typography variant="small" className="mb-2 block">
          Tabs
        </Typography>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="pt-3">
            <Typography variant="muted">Manage your profile details.</Typography>
          </TabsContent>
          <TabsContent value="security" className="pt-3">
            <Typography variant="muted">Update password and two-factor auth.</Typography>
          </TabsContent>
        </Tabs>
      </div>

      <Separator />

      <div>
        <Typography variant="small" className="mb-2 block">
          Accordion
        </Typography>
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>What is this page?</AccordionTrigger>
            <AccordionContent>
              An internal reference of every base component available in this template.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Where do components live?</AccordionTrigger>
            <AccordionContent>
              Custom components in <code>src/components/ui</code>, shadcn primitives flat in the
              same folder.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DemoSection>
  );
}

function OverlaySection() {
  return (
    <TooltipProvider>
      <DemoSection
        id="overlay"
        title="Overlay"
        description="Dialog, Popover, Tooltip, and Dropdown Menu."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Open dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete component?</DialogTitle>
                <DialogDescription>
                  This is a demo dialog — nothing will actually be deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Open popover
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Typography variant="small" className="mb-1 block">
                Quick settings
              </Typography>
              <Typography variant="muted">Floating panel anchored to its trigger.</Typography>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Plus className="h-4 w-4" />
                New item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DemoSection>
    </TooltipProvider>
  );
}

function FeedbackSection() {
  const toast = useToast();

  return (
    <DemoSection
      id="feedback"
      title="Feedback"
      description="Alert, Skeleton, and toast notifications."
      className="lg:col-span-2"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Alert>
          <Info />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>This is an informational alert.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>This is a destructive alert.</AlertDescription>
        </Alert>
      </div>

      <div className="flex flex-col gap-2">
        <Typography variant="small">Skeleton</Typography>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => toast.success('Saved successfully')}>
          Trigger success toast
        </Button>
        <Button size="sm" variant="outline" onClick={() => toast.error('Something failed')}>
          Trigger error toast
        </Button>
      </div>
    </DemoSection>
  );
}

export function ComponentsShowcase() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <FormsSection />
      <DataDisplaySection />
      <LayoutSection />
      <OverlaySection />
      <FeedbackSection />
    </div>
  );
}
