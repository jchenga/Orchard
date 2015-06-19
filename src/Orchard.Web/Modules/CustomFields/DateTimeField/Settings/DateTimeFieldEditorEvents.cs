using System.Collections.Generic;
using Orchard.ContentManagement;
using Orchard.ContentManagement.MetaData;
using Orchard.ContentManagement.MetaData.Builders;
using Orchard.ContentManagement.MetaData.Models;
using Orchard.ContentManagement.ViewModels;

namespace CustomFields.DateTimeField.Settings {
    public class DateTimeFieldEditorEvents : ContentDefinitionEditorEventsBase {
        public override IEnumerable<TemplateViewModel> PartFieldEditor(ContentPartFieldDefinition definition) {
            if (definition.FieldDefinition.Name == "DateTimeField") {
                var model = definition.Settings.GetModel<DateTimeFieldSettings>();
                yield return DefinitionTemplate(model);
            }
        }

        public override IEnumerable<TemplateViewModel> PartFieldEditorUpdate(ContentPartFieldDefinitionBuilder builder, IUpdateModel updateModel) {
            var model = new DateTimeFieldSettings();
            if (builder.FieldType != "DateTimeField") {
                yield break;
            }

            if (updateModel.TryUpdateModel(model, "DateTimeFieldSettings", null, null)) {
                builder.WithSetting("DateTimeFieldSettings.Display", model.Display.ToString());
            }

            yield return DefinitionTemplate(model);
        }
    }
}