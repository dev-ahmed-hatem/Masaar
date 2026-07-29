"use client";

import Link from "next/link";
import { useState } from "react";
import { App, Button, Card, Form, Input, Result, Select, Typography } from "antd";

import { ApiError } from "@/lib/api";
import { submitApplication } from "@/lib/applications";

const { Title, Paragraph } = Typography;

export type ApplyDict = Record<string, string>;

export default function BecomeTeacherForm({
  dict,
  locale,
}: {
  dict: ApplyDict;
  locale: string;
}) {
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onFinish(values: {
    market: string;
    full_name: string;
    phone: string;
    email?: string;
    bio: string;
    intro_video_url?: string;
  }) {
    setSubmitting(true);
    try {
      await submitApplication({
        market: values.market,
        full_name: values.full_name,
        phone: values.phone,
        email: values.email || undefined,
        bio: values.bio,
        intro_video_url: values.intro_video_url || undefined,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_application") {
        message.warning(dict.duplicate);
      } else {
        message.error(err instanceof ApiError ? err.message : dict.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card>
        <Result
          status="success"
          title={dict.successTitle}
          subTitle={dict.successBody}
          extra={
            <Link href={`/${locale}`} className="btn btn-primary">
              {dict.backHome}
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="text-center">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}
        >
          {dict.badge}
        </span>
        <Title level={2} className="!mt-4" style={{ fontFamily: "var(--font-display)" }}>
          {dict.title}
        </Title>
        <Paragraph type="secondary" className="mx-auto max-w-prose text-base">
          {dict.intro}
        </Paragraph>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[dict.step1, dict.step2, dict.step3].map((step, i) => (
          <div key={step} className="surface surface-hover flex items-start gap-3 p-5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: "var(--grad-brand)", boxShadow: "var(--glow)" }}
            >
              {i + 1}
            </span>
            <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
              {step}
            </span>
          </div>
        ))}
      </div>

      <Card title={dict.formTitle}>
        <Form
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          initialValues={{ market: "EG" }}
        >
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="market" label={dict.market} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "EG", label: dict.marketEG },
                  { value: "SA", label: dict.marketSA },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="full_name"
              label={dict.fullName}
              rules={[{ required: true, message: dict.requiredName }]}
            >
              <Input autoComplete="name" />
            </Form.Item>
            <Form.Item
              name="phone"
              label={dict.phone}
              rules={[{ required: true, message: dict.requiredPhone }]}
              extra={dict.phoneHint}
            >
              <Input inputMode="tel" placeholder="01xxxxxxxxx" autoComplete="tel" />
            </Form.Item>
            <Form.Item name="email" label={dict.email} rules={[{ type: "email" }]}>
              <Input inputMode="email" autoComplete="email" />
            </Form.Item>
          </div>
          <Form.Item
            name="bio"
            label={dict.bio}
            rules={[{ required: true, message: dict.requiredBio }]}
            extra={dict.bioHint}
          >
            <Input.TextArea rows={4} maxLength={2000} showCount />
          </Form.Item>
          <Form.Item
            name="intro_video_url"
            label={dict.video}
            extra={dict.videoHint}
            rules={[{ type: "url", message: dict.invalidUrl }]}
          >
            <Input placeholder="https://youtube.com/watch?v=…" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
            {dict.submit}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
