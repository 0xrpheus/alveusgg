import React, { useCallback, useRef, useState } from "react";
import { Duration } from "luxon";

import { env } from "@/env/index.mjs";
import {
  notificationCategories,
  notificationLinkSuggestions,
  notificationLinkDefault,
} from "@/config/notifications";
import { trpc } from "@/utils/trpc";

import logoImage from "@/assets/push-image/logo.png";
import defaultBgImage from "@/assets/push-image/default.png";

import { TextField } from "@/components/shared/form/TextField";
import { TextAreaField } from "@/components/shared/form/TextAreaField";
import { Button, defaultButtonClasses } from "@/components/shared/Button";
import { SelectBoxField } from "@/components/shared/form/SelectBoxField";
import {
  UploadAttachmentsField,
  useUploadAttachmentsData,
} from "@/components/shared/form/UploadAttachmentsField";
import { useFileUpload } from "@/components/shared/hooks/useFileUpload";
import { ImageUploadAttachment } from "@/components/shared/form/ImageUploadAttachment";
import { PushImageCanvas } from "@/components/notifications/PushImageCanvas";
import { Headline } from "@/components/admin/Headline";
import { CheckboxField } from "@/components/shared/form/CheckboxField";
import { Fieldset } from "@/components/shared/form/Fieldset";
import { LocalDateTimeField } from "@/components/shared/form/LocalDateTimeField";
import { MessageBox } from "@/components/shared/MessageBox";
import IconLoading from "@/icons/IconLoading";
import { classes } from "@/utils/classes";

export const allowedFileTypes = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
type AllowedFileTypes = typeof allowedFileTypes;

export function SendNotificationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const sendNotification = trpc.adminNotifications.sendNotification.useMutation(
    {
      onSuccess: () => {
        if (formRef.current) {
          formRef.current.reset();
        }
      },
    }
  );

  const createFileUpload =
    trpc.adminNotifications.createFileUpload.useMutation();
  const upload = useFileUpload<AllowedFileTypes>(
    (signature) => createFileUpload.mutateAsync(signature),
    { allowedFileTypes }
  );
  const imageAttachmentData = useUploadAttachmentsData();
  const image = imageAttachmentData.files[0];

  const [category, setCategory] = useState("announcements");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [link, setLink] = useState(notificationLinkDefault);

  const [isScheduled, setIsScheduled] = useState(false);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const imageUrl = image?.status === "upload.done" ? image.url : undefined;
      const scheduledStartAt =
        (isScheduled && String(data.get("scheduledStartAt"))) || undefined;
      const scheduledEndAt =
        (isScheduled && String(data.get("scheduledEndAt"))) || undefined;

      sendNotification.mutate({
        text: String(data.get("text") || ""),
        tag: String(data.get("tag") || ""),
        title: String(data.get("title") || ""),
        linkUrl: String(data.get("url") || ""),
        scheduledStartAt,
        scheduledEndAt,
        imageUrl,
      });
    },
    [image, isScheduled, sendNotification]
  );

  const previewImageUrl =
    (image &&
      ((image.status === "upload.pending" && image.dataURL) ||
        (image.status === "upload.done" && image.url))) ||
    defaultBgImage.src;

  return (
    <div>
      <form ref={formRef} onSubmit={submit}>
        {sendNotification.isLoading && (
          <MessageBox variant="default">
            <IconLoading className="mr-2 h-5 w-5 animate-spin" />
            Notification is being sent …
          </MessageBox>
        )}
        {sendNotification.isError && (
          <MessageBox variant="failure">
            ERROR: Could not send the notification!
          </MessageBox>
        )}

        <div className="flex flex-col gap-5">
          <SelectBoxField
            label="Category"
            name="tag"
            required
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            size={notificationCategories.length}
          >
            {notificationCategories.map(({ tag, label, ttl }) => (
              <option key={tag} value={tag}>
                {label} (push active for{" "}
                {Duration.fromMillis(ttl * 1000, { locale: "en-US" })
                  .rescale()
                  .toHuman({ unitDisplay: "short" })}
                )
              </option>
            ))}
          </SelectBoxField>

          <TextField
            label="Title (100 chars)"
            name="title"
            isRequired={true}
            minLength={1}
            maxLength={100}
            value={title}
            onChange={(value) => setTitle(value)}
          />

          <TextAreaField
            label="Message text (180 chars)"
            name="text"
            isRequired={true}
            minLength={2}
            maxLength={180}
            value={text}
            onChange={(value) => setText(value)}
          />

          <TextField
            label="Link"
            name="url"
            type="url"
            autoComplete="url"
            list="notification-link-suggestions"
            showResetButton={true}
            value={link}
            onChange={(value) => setLink(value)}
            pattern="https?://.*"
          />

          <datalist id="notification-link-suggestions">
            {notificationLinkSuggestions.map((link) => (
              <option key={link.url} value={link.url}>
                {link.label}
              </option>
            ))}
          </datalist>

          <UploadAttachmentsField
            label="Image"
            {...imageAttachmentData}
            maxNumber={1}
            upload={upload}
            allowedFileTypes={allowedFileTypes}
            renderAttachment={({ fileReference, ...props }) => (
              <ImageUploadAttachment {...props} fileReference={fileReference} />
            )}
          />

          <Fieldset legend="Announcement details">
            <div>
              <CheckboxField
                name="isScheduled"
                value="true"
                isSelected={isScheduled}
                onChange={(selected) => setIsScheduled(selected)}
              >
                Is scheduled event (start/end date)
              </CheckboxField>
            </div>

            <div
              className={classes(
                `flex flex-wrap gap-4 border-l pl-3`,
                !isScheduled && "hidden"
              )}
            >
              <LocalDateTimeField
                showResetButton
                name="scheduledStartAt"
                label="Start (Central Time)"
                required
              />
              <LocalDateTimeField
                showResetButton
                name="scheduledEndAt"
                label="End (Central Time)"
              />
            </div>
          </Fieldset>

          {env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS_ADVANCED && (
            <Fieldset legend="Publication channels">
              <div className="flex flex-wrap gap-4">
                <CheckboxField
                  name="channel"
                  value="push"
                  className="rounded-lg border border-white/20 px-2"
                >
                  Push
                </CheckboxField>
                <CheckboxField
                  name="channel"
                  value="discord"
                  className="rounded-lg border border-white/20 px-2"
                >
                  Discord
                </CheckboxField>
                <CheckboxField
                  name="channel"
                  value="twitter"
                  className="rounded-lg border border-white/20 px-2"
                >
                  Twitter
                </CheckboxField>
                <CheckboxField
                  name="channel"
                  value="updatesPage"
                  className="rounded-lg border border-white/20 px-2"
                >
                  Updates page
                </CheckboxField>
              </div>
            </Fieldset>
          )}

          <Button type="submit" className={defaultButtonClasses}>
            Send notification
          </Button>
        </div>
      </form>

      {env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS_ADVANCED && (
        <div className="mt-10 flex gap-4 border-t border-black/50 pt-5">
          <div className="flex-1">
            <Headline>OpenGraph (Twitter, Facebook etc.)</Headline>

            <div className="overflow-hidden rounded-xl">
              <PushImageCanvas
                title={title}
                text={text}
                backgroundImageUrl={previewImageUrl}
                logoImageUrl={logoImage.src}
              />
            </div>
          </div>
          <div className="flex-1">
            <Headline>Instagram</Headline>

            <div className="overflow-hidden rounded-xl">
              <PushImageCanvas
                title={title}
                text={text}
                backgroundImageUrl={previewImageUrl}
                logoImageUrl={logoImage.src}
                width={1080}
                height={1080}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
