import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui";
import { getServerSession } from "@/lib/server-session";

export const metadata = {
  title: "Devlog guide",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 text-lg font-semibold text-foreground first:mt-0">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-foreground">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
      {children}
    </ul>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="mt-3 rounded-lg border-l-4 border-carnival-blue/60 bg-muted/40 px-4 py-3 text-sm italic leading-relaxed text-muted-foreground">
      {children}
    </blockquote>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

function Divider() {
  return <div className="my-8 h-px w-full bg-border" />;
}

const TEMPLATE = `Project: [name]
Day: [date]

What I worked on:
[Detailed. Say what you built, the tools you used, and the choices
you made. Enough that the hours make sense.]

What gave me trouble:
[What broke or confused you and how you got past it. Keep it simple.]

AI use:
[Used (tool) for (what), wrote the rest myself. / Didn't use any.]
`;

export default async function DevlogGuidePage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/devlog-guide");
  }

  return (
    <AppShell title="Devlog guide">
      <div className="mx-auto max-w-3xl pb-12">
        <Card>
          <CardContent className="px-6 py-8 sm:px-10 sm:py-10">
            <header>
              <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
                How to write a good Carnival devlog
              </h1>
              <P>
                A devlog is just you writing down what you did. That&apos;s it. It&apos;s how reviewers
                figure out what you built, check that your hours add up, and sort out your grant.
                It&apos;s also kind of a nice thing to look back on once your project is done.
              </P>
              <P>
                Each devlog usually covers about a day of work. The whole point is this: if someone
                who&apos;s never seen your project reads your devlog, they should be able to tell what
                you did, what was annoying about it, and where your time went. If they can do that,
                you&apos;re good.
              </P>
            </header>

            <Divider />

            <section>
              <H2>What goes in it</H2>
              <P>Every devlog needs these:</P>
              <UL>
                <li>
                  <Strong>The day it covers.</Strong> Just the date the work happened.
                </li>
                <li>
                  <Strong>Your hours.</Strong> These get pulled from Hackatime automatically. You
                  don&apos;t have to add them up yourself, but do double-check the number looks right
                  before you submit, since that&apos;s what your grant is based on.
                </li>
                <li>
                  <Strong>What you actually worked on.</Strong> In detail. This is the main thing
                  and the part people rush. More on it below.
                </li>
                <li>
                  <Strong>What gave you trouble.</Strong> Stuff that broke, stuff that confused
                  you, and how you got past it.
                </li>
                <li>
                  <Strong>Whether you used AI.</Strong> One honest line at the end.
                </li>
              </UL>
            </section>

            <Divider />

            <section>
              <H2>The part everyone rushes: what you worked on</H2>
              <P>
                Your description should match your hours. If Hackatime says you spent 4 hours, what
                you write should sound like 4 hours of actual work. Reviewers read the details and
                check that it lines up. A short vague log with a big hour count is the quickest way
                to get flagged, so just say what you did.
              </P>
              <P>
                The easiest way to do this well is to get technical. Talk about how the thing
                works. That&apos;s what shows you actually built it and understand it.
              </P>

              <H3>Too vague (don&apos;t do this):</H3>
              <Quote>Worked on my extension. Added some features and fixed bugs. Made it look better.</Quote>
              <P>
                Nobody reading that can tell what you built or whether you get how your own code
                works.
              </P>

              <H3>Detailed (do this):</H3>
              <Quote>
                <div>
                  <em>Tab Rot — June 4 — 3h 40m</em>
                </div>
                <div className="mt-3">
                  Today I got the decay system actually working. Every tab now remembers the last
                  time you looked at it, and a background script checks every few minutes how long
                  it&apos;s been ignored. I turned that idle time into three &ldquo;rot&rdquo; stages: faded after a
                  day, grainy after three days, cracked after a week. Each stage is a different CSS
                  filter stacked on the tab.
                </div>
                <div className="mt-3">
                  Most of today went into the cracked look. Chrome won&apos;t let you just restyle a
                  favicon directly, so I had to redraw it onto a canvas, mess with the pixels
                  myself, and swap the new one back in. Getting it to look like real cracked paper
                  instead of random static took way longer than I expected.
                </div>
              </Quote>

              <P>
                See the difference? The second one tells you the timing logic, the three stages,
                and the canvas trick. A reviewer reads it and instantly believes the hours and
                gets how it works.
              </P>

              <P>If you&apos;re not sure you&apos;ve got enough, just ask yourself:</P>
              <UL>
                <li>What did I build or change today?</li>
                <li>What tools or libraries did I use?</li>
                <li>What choices did I make, and why?</li>
                <li>What can the thing do now that it couldn&apos;t this morning?</li>
              </UL>
            </section>

            <Divider />

            <section>
              <H2>Writing about the hard parts</H2>
              <P>
                Don&apos;t skip this. The challenges are usually the most interesting bit, and
                they&apos;re solid proof the work was real.
              </P>
              <P>
                Keep it simple, like you&apos;re explaining it to a friend. Say what went wrong, why
                it was tricky, and what you did about it.
              </P>
              <Quote>
                The Wayback Machine API kept giving me snapshots that broke when I loaded them in
                an iframe. Took me forever to figure out it was because the archive was trying to
                load its own toolbar on top of the page. Once I added the right flag to the URL it
                stopped doing that.
              </Quote>
              <P>That&apos;s perfect. Honest, clear, and you can tell they actually solved it.</P>
            </section>

            <Divider />

            <section>
              <H2>A few things that just make this easier</H2>
              <UL>
                <li>
                  Write it as you go instead of all at the end. Drop a line whenever you finish
                  something and the devlog basically writes itself.
                </li>
                <li>
                  Screenshots and little clips go a long way. A 5-second gif of your feature
                  working says more than a paragraph.
                </li>
                <li>
                  Bad days are fine to log. &ldquo;Spent 3 hours fighting one CSS bug and got nowhere&rdquo;
                  is a real devlog. Building stuff isn&apos;t always pretty.
                </li>
              </UL>
            </section>

            <Divider />

            <section>
              <H2>The AI thing</H2>
              <P>Two separate things here, don&apos;t mix them up:</P>

              <H3>Using AI to build your project</H3>
              <P>
                Allowed, you just have to say so honestly. End your devlog with a line like:
              </P>
              <Quote>
                <em>AI use:</em> used Claude to help debug my background script, wrote the rest
                myself. / <em>AI use:</em> didn&apos;t use any.
              </Quote>
              <P>Specific and honest is exactly what we want.</P>

              <H3>Using AI to write the devlog itself</H3>
              <P>Please don&apos;t. Write it in your own words. Here&apos;s why it actually matters:</P>
              <UL>
                <li>
                  The devlog is how we know <em>you</em> did the work and get it. AI-written ones
                  are generic and don&apos;t say anything real about your day.
                </li>
                <li>
                  Writing it yourself makes you stop and think about what you built, which honestly
                  just makes you better at this.
                </li>
                <li>
                  Your own words, with the actual details and the stuff that annoyed you, are way
                  more convincing than clean AI writing anyway.
                </li>
              </UL>
              <P>
                You don&apos;t have to write well. You just have to write what really happened,
                specifically. That&apos;s always enough.
              </P>
            </section>

            <Divider />

            <section>
              <H2>Copy-paste template</H2>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-foreground">
{TEMPLATE}
              </pre>
            </section>

            <Divider />

            <P>
              And that&apos;s pretty much it. Build something you actually care about, write down
              what you really did, and let it speak for itself. See you on the midway.
            </P>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
