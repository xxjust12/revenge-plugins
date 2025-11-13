import { React, ReactNative } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { showInputAlert } from "@vendetta/ui/alerts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { before, after } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";

const { FormRow } = Forms;
const MessageStore = findByStoreName("MessageStore");
const FluxDispatcher = findByProps("dispatch", "subscribe");

// Store edited messages
const editedMessages = new Map();

let patches = [];

export default {
  onLoad: () => {
    // Patch message rendering to show edited content
    const MessageContent = findByProps("default", "type").default;
    
    patches.push(
      before("type", MessageContent, (args) => {
        const [props] = args;
        const messageId = props?.message?.id;
        
        if (messageId && editedMessages.has(messageId)) {
          // Replace the message content with edited version
          props.message = {
            ...props.message,
            content: editedMessages.get(messageId)
          };
        }
      })
    );

    // Add context menu option to edit messages
    const MessageContextMenu = findByProps("default").default;
    
    patches.push(
      after("default", MessageContextMenu, (args, res) => {
        const message = args[0]?.message;
        if (!message) return res;

        // Add our custom menu item
        res.props.children.push(
          <FormRow
            label="Edit Message (Local)"
            leading={
              <FormRow.Icon source={getAssetIDByName("ic_edit_24px")} />
            }
            onPress={() => {
              showInputAlert({
                title: "Edit Message",
                placeholder: "Enter new message content...",
                initialValue: editedMessages.get(message.id) || message.content,
                confirmText: "Save",
                confirmColor: "brand" as ButtonColors,
                onConfirm: (newContent: string) => {
                  if (newContent.trim()) {
                    // Store the edited message
                    editedMessages.set(message.id, newContent);
                    
                    // Force re-render by dispatching a fake message update
                    FluxDispatcher.dispatch({
                      type: "MESSAGE_UPDATE",
                      message: {
                        ...message,
                        content: newContent,
                        edited_timestamp: new Date().toISOString()
                      }
                    });
                  }
                },
                cancelText: "Cancel"
              });
            }}
          />
        );

        // Add option to reset message to original
        if (editedMessages.has(message.id)) {
          res.props.children.push(
            <FormRow
              label="Reset to Original"
              leading={
                <FormRow.Icon source={getAssetIDByName("ic_message_delete")} />
              }
              onPress={() => {
                editedMessages.delete(message.id);
                
                // Force re-render
                FluxDispatcher.dispatch({
                  type: "MESSAGE_UPDATE",
                  message: message
                });
              }}
            />
          );
        }

        return res;
      })
    );
  },

  onUnload: () => {
    // Clean up patches
    patches.forEach(unpatch => unpatch());
    patches = [];
    
    // Clear edited messages
    editedMessages.clear();
  },

  settings: () => {
    return (
      <FormRow
        label="Message Editor"
        subLabel={`Currently editing ${editedMessages.size} message(s). Long-press any message to edit it locally.`}
      />
    );
  }
};
